import "dotenv/config";

export const envChecker = () => {
  const {
    OPENAI_API_KEY,
    QDRANT_URL,
    QDRANT_API_KEY,
    DATABASE_URL,
    PLANNING_MODEL,
    EMBEDDING_MODEL,
    PORT,
  } = process.env;

  const missingVars: string[] = [];

  if (!OPENAI_API_KEY) missingVars.push("OPENAI_API_KEY");
  if (!QDRANT_URL) missingVars.push("QDRANT_URL");
  if (!QDRANT_API_KEY) missingVars.push("QDRANT_API_KEY");
  if (!DATABASE_URL) missingVars.push("DATABASE_URL");
  if (!PLANNING_MODEL) missingVars.push("PLANNING_MODEL");
  if (!EMBEDDING_MODEL) missingVars.push("EMBEDDING_MODEL");
  if (!PORT) missingVars.push("PORT");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missingVars.join(", ")}`
    );
  }
};
