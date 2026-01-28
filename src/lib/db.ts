import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

// Validación de conexión
if (process.env.NODE_ENV === "production" && !process.env.POSTGRES_URL) {
    console.error("❌ ERROR CRÍTICO: POSTGRES_URL no está definida en el entorno de producción.");
    console.error("Asegúrate de haber vinculado el Storage de Vercel Postgres a este proyecto.");
}

export const db = drizzle(sql, { schema });
