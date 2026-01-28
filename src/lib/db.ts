import { createPool } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";

// Buscar cualquier variable de conexión disponible
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production" && !connectionString) {
    console.error("❌ ERROR CRÍTICO: No se encontró POSTGRES_URL ni DATABASE_URL en el entorno.");
}

// Crear el pool manualmente para asegurar que use la variable correcta
const pool = createPool({
    connectionString: connectionString
});

export const db = drizzle(pool, { schema });
