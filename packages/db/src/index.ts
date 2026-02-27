import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export * from "./schema";

export async function healthCheckDb(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1`;
    return result.length > 0;
  } catch (error) {
    console.error("DB Health Check Failed:", error);
    return false;
  }
}
