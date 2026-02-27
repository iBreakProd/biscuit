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
  const client = await getRedisClient();
  const streams = [{ key: stream, id: lastId }];
  
  if (blockMs !== undefined && blockMs >= 0) {
    return await client.xRead(streams, { BLOCK: blockMs, COUNT: count });
  } else {
    return await client.xRead(streams, { COUNT: count });
  }
}
