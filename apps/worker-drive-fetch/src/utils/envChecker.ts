import "dotenv/config";

export const envChecker = () => {
  const { DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, REDIS_URL } = process.env;

  const missingVars: string[] = [];

  if (!DATABASE_URL) missingVars.push("DATABASE_URL");
  if (!GOOGLE_CLIENT_ID) missingVars.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missingVars.push("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_REDIRECT_URI) missingVars.push("GOOGLE_REDIRECT_URI");
  if (!REDIS_URL) missingVars.push("REDIS_URL");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missingVars.join(", ")}`
    );
  }
};
