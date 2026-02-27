import express from "express";
import cors from "cors";
import { Request, Response } from "express";

import { envChecker } from "./utils/envChecker";

envChecker();

import { healthCheckDb } from "@repo/db";
import { healthCheckRedis } from "@repo/redis";
import { healthCheckQdrant } from "@repo/qdrant";
import { HealthStatusSchema } from "@repo/zod-schemas";

const app = express();
app.use(cors());
app.use(express.json());

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
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
