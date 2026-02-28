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
    REDIS_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    JWT_SECRET,
  } = process.env;

  const missingVars: string[] = [];

  if (!OPENAI_API_KEY) missingVars.push("OPENAI_API_KEY");
  if (!QDRANT_URL) missingVars.push("QDRANT_URL");
  if (!QDRANT_API_KEY) missingVars.push("QDRANT_API_KEY");
  if (!DATABASE_URL) missingVars.push("DATABASE_URL");
  if (!PLANNING_MODEL) missingVars.push("PLANNING_MODEL");
  if (!EMBEDDING_MODEL) missingVars.push("EMBEDDING_MODEL");
  if (!PORT) missingVars.push("PORT");
  if (!REDIS_URL) missingVars.push("REDIS_URL");
  if (!GOOGLE_CLIENT_ID) missingVars.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missingVars.push("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_REDIRECT_URI) missingVars.push("GOOGLE_REDIRECT_URI");
  if (!JWT_SECRET) missingVars.push("JWT_SECRET");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missingVars.join(", ")}`
    );
  }
};
