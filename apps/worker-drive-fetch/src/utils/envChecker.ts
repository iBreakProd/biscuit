import "dotenv/config";

export const envChecker = () => {
  const { DATABASE_URL } = process.env;

  const missingVars: string[] = [];

  if (!DATABASE_URL) missingVars.push("DATABASE_URL");

  if (missingVars.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missingVars.join(", ")}`
    );
  }
};
