import "dotenv/config";

export const envChecker = () => {
  const { DATABASE_URL, OPENAI_API_KEY, QDRANT_URL, REDIS_URL, QDRANT_API_KEY } = process.env;

  const missingVars: string[] = [];

  if (!DATABASE_URL) missingVars.push("DATABASE_URL");
  if (!OPENAI_API_KEY) missingVars.push("OPENAI_API_KEY");
  if (!QDRANT_URL) missingVars.push("QDRANT_URL");
  if (!REDIS_URL) missingVars.push("REDIS_URL");
  if (!QDRANT_API_KEY) missingVars.push("QDRANT_API_KEY");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missingVars.join(", ")}`
    );
  }
};
