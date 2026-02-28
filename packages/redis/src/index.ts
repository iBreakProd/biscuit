import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL,
  });

  redisClient.on("error", (err) => {
    console.error("Redis Client Error", err);
  });

  await redisClient.connect();
  return redisClient;
}

export async function getIsolatedRedisClient(): Promise<RedisClientType> {
  const client = createClient({
    url: process.env.REDIS_URL,
  }) as any as RedisClientType;
  client.on("error", (err) => {
    console.error("Isolated Redis Client Error", err);
  });
  await client.connect();
  return client;
}

export async function healthCheckRedis(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis Health Check Failed:", error);
    return false;
  }
}

export async function redisXAdd(stream: string, fields: Record<string, string>): Promise<string> {
  const client = await getRedisClient();
  return await client.xAdd(stream, "*", fields);
}

export async function redisXRead(
  stream: string,
  lastId: string = "0",
  count: number = 50,
  blockMs?: number
) {
  const streams = [{ key: stream, id: lastId }];
  
  if (blockMs !== undefined && blockMs >= 0) {
    const client = await getIsolatedRedisClient();
    try {
      return await client.xRead(streams, { BLOCK: blockMs, COUNT: count });
    } finally {
      await client.disconnect();
    }
  } else {
    const client = await getRedisClient();
    return await client.xRead(streams, { COUNT: count });
  }
}

import { AgentEvent, AgentEventSchema } from "@repo/zod-schemas";

export async function appendAgentEvent(taskId: string, event: Omit<AgentEvent, 'id'>): Promise<AgentEvent> {
  const streamKey = `agent_events:${taskId}`;
  console.log(`[Redis:appendAgentEvent] Getting client for task ${taskId}...`);
  const client = await getRedisClient();
  console.log(`[Redis:appendAgentEvent] Client retrieved. Performing xAdd for task ${taskId}...`);
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Redis xAdd timed out after 5 seconds")), 5000)
  );

  const xAddPromise = client.xAdd(streamKey, "*", { data: JSON.stringify(event) }, {
    TRIM: {
      strategy: 'MAXLEN',
      strategyModifier: '~',
      threshold: 1000
    }
  });

  const id = await Promise.race([xAddPromise, timeoutPromise]);
  console.log(`[Redis:appendAgentEvent] xAdd successful. ID: ${id}. Setting expiration...`);

  // Spec mandates roughly 15 minutes TTL for the stream.
  // 900 seconds = 15 minutes.
  await client.expire(streamKey, 900);
  
  return {
    ...event,
    id,
  };
}

export async function readAgentEvents(
  taskId: string,
  sinceId: string | null = null,
  limit: number = 50
): Promise<AgentEvent[]> {
  const streamKey = `agent_events:${taskId}`;
  const startId = sinceId || "0-0";
  
  const result = await redisXRead(streamKey, startId, limit);
  
  if (!result || result.length === 0) {
    return [];
  }
  
  const messages = result[0]?.messages || [];
  
  return messages.map((msg) => {
    const rawData = msg.message.data;
    const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    
    // Validate with Zod
    const validated = AgentEventSchema.parse({
      ...parsed,
      id: msg.id,
    });
    
    return validated;
  });
}

// --- Background Worker Helpers ---

export async function redisCreateConsumerGroup(stream: string, groupName: string) {
  const client = await getRedisClient();
  try {
    // 0 means start from the very beginning of the stream if no existing cursor
    await client.xGroupCreate(stream, groupName, "0", { MKSTREAM: true });
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }
}

export async function redisXReadGroup(
  stream: string,
  groupName: string,
  consumerName: string,
  count: number = 10,
  blockMs: number = 2000
) {
  const client = await getIsolatedRedisClient();
  const streams = [{ key: stream, id: ">" }]; // > means messages never delivered to this group

  try {
    return await client.xReadGroup(
      groupName,
      consumerName,
      streams,
      { COUNT: count, BLOCK: blockMs }
    );
  } catch (err: any) {
    if (err.message && err.message.includes("NOGROUP")) {
      console.log(`[Redis] Setup missing, creating Consumer Group '${groupName}' for stream '${stream}'...`);
      await redisCreateConsumerGroup(stream, groupName);
      
      return await client.xReadGroup(
        groupName,
        consumerName,
        streams,
        { COUNT: count, BLOCK: blockMs }
      );
    }
    throw err;
  } finally {
    await client.disconnect();
  }
}

export async function redisXAck(stream: string, groupName: string, messageId: string) {
  const client = await getRedisClient();
  await client.xAck(stream, groupName, messageId);
}

export async function enqueueDriveFetchJob(userId: string, fileId: string) {
  // Hardcoded shard 0 for MVP
  const streamKey = "drive_fetch:0";
  return await redisXAdd(streamKey, { 
    userId, 
    fileId, 
    enqueuedAt: Date.now().toString() 
  });
}

export async function enqueueDriveVectorizeJob(userId: string, fileId: string) {
  // Hardcoded shard 0 for MVP
  const streamKey = "drive_vectorize:0";
  return await redisXAdd(streamKey, { 
    userId, 
    fileId, 
    enqueuedAt: Date.now().toString() 
  });
}
