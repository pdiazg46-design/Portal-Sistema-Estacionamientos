import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

// Validación de conexión mejorada
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production" && !url) {
    console.error("❌ ERROR CRÍTICO: No se encontró POSTGRES_URL ni DATABASE_URL.");
}

export const db = drizzle(sql, { schema });
