import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

// En Vercel se usa POSTGRES_URL automáticamente
export const db = drizzle(sql, { schema });
