import { Router, Request, Response } from "express";
import { getIsolatedRedisClient, readAgentEvents } from "@repo/redis";
import { TaskIdSchema, AgentEventsQuerySchema } from "@repo/zod-schemas";

const router: Router = Router();

router.get("/agent/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = TaskIdSchema.parse(req.params.taskId);
    let lastEventId = AgentEventsQuerySchema.parse(req.query).since || "0-0";
    const streamKey = `agent_events:${taskId}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify({ message: "connected" })}\n\n`);

    const client = await getIsolatedRedisClient();

    // Loop for long-polling the redis stream
    const interval = setInterval(async () => {
      try {
        // We use raw xRead here for BLOCKing capability because readAgentEvents currently doesn't expose BLOCK
        const result = await client.xRead([{ key: streamKey, id: lastEventId }], {
          BLOCK: 5000,
          COUNT: 10,
        });

        if (result && result.length > 0) {
          const messages = result[0]!.messages;
          for (const msg of messages) {
            lastEventId = msg.id;
            const parsed = typeof msg.message.data === "string" 
              ? JSON.parse(msg.message.data) 
              : msg.message.data;
            
            parsed.id = msg.id;

            res.write(`id: ${msg.id}\n`);
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);

            if (parsed.type === "finish") {
              clearInterval(interval);
              res.write(`event: finish\ndata: {}\n\n`);
              res.end();
              return;
            }
          }
        }
      } catch (err) {
        console.error("Error reading from redis stream", err);
      }
    }, 100);

    req.on("close", () => {
      clearInterval(interval);
      client.disconnect().catch(err => console.error("Error disconnecting isolated SSE redis client:", err));
    });
  } catch (error) {
    console.error("SSE stream failed", error);
    res.status(500).end();
  }
});

export default router;
