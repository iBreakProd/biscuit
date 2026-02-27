import { Router, Request, Response } from "express";
import { getRedisClient } from "@repo/redis";

const router: Router = Router();

router.get("/agent/:taskId", async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    let lastEventId = (req.query.since as string) || "0";
    const streamKey = `agent_events:${taskId}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify({ message: "connected" })}\n\n`);

    const client = await getRedisClient();

    // Loop for long-polling the redis stream
    const interval = setInterval(async () => {
      try {
        // Block for up to 5000ms
        const result = await client.xRead([{ key: streamKey, id: lastEventId }], {
          BLOCK: 5000,
          COUNT: 10,
        });

        if (result && result.length > 0) {
          const messages = result[0]!.messages;
          for (const msg of messages) {
            lastEventId = msg.id;
            const parsed = msg.message.data ? JSON.parse(msg.message.data) : msg.message;
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
    });
  } catch (error) {
    console.error("SSE stream failed", error);
    res.status(500).end();
  }
});

export default router;
