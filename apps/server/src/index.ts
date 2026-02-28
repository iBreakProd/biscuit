import express from "express";
import cors from "cors";
import { Request, Response } from "express";

import { envChecker } from "./utils/envChecker";

envChecker();

import { healthCheckDb } from "@repo/db";
import { healthCheckRedis } from "@repo/redis";
import { healthCheckQdrant, ensureDriveVectorsCollection } from "@repo/qdrant";
import { HealthStatusSchema } from "@repo/zod-schemas";

import chatRouter from "./routes/chats";
import tasksRouter from "./routes/tasks";
import sseRouter from "./routes/sse";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/chats", chatRouter);
app.use("/tasks", tasksRouter);
app.use("/sse", sseRouter);

import authRouter from "./auth/google";
app.use("/auth", authRouter);

import driveRouter from "./drive/routes";
app.use("/drive", driveRouter);

import debugRouter from "./routes/debug";
app.use("/debug", debugRouter);

import { requireAuth } from "./auth/middleware";

import { seedDummyData } from "./dev/seedVectorData";
app.get("/seed", requireAuth, async (req: Request, res: Response) => {
  await seedDummyData();
  res.json({ status: "Seeded successfully" });
});

app.get("/health", async (req: Request, res: Response) => {
  const [dbOk, redisOk, qdrantOk] = await Promise.all([
    healthCheckDb(),
    healthCheckRedis(),
    healthCheckQdrant(),
  ]);

  const health = {
    db: dbOk ? "ok" : "error",
    redis: redisOk ? "ok" : "error",
    qdrant: qdrantOk ? "ok" : "error",
  };

  try {
    const validatedHealth = HealthStatusSchema.parse(health);
    res.json(validatedHealth);
  } catch (error) {
    console.error("Health schema validation failed", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 3001;

ensureDriveVectorsCollection().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch((err: any) => {
  console.error("Failed to ensure Qdrant collection on startup:", err);
  process.exit(1);
});
