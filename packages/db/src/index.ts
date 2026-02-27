import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export async function healthCheckDb(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT 1");
    client.release();
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error("DB Health Check Failed:", error);
    return false;
  }
}
