
import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno explícitamente
const envPath = path.resolve(process.cwd(), ".env.production");
console.log("Cargando variables desde:", envPath);
const resultEnv = dotenv.config({ path: envPath });

if (resultEnv.error) {
    console.error("Error cargando .env.production:", resultEnv.error);
}

console.log("POSTGRES_URL existe:", !!process.env.POSTGRES_URL);
if (!process.env.POSTGRES_URL) {
    console.log("Variables de entorno disponibles (claves):", Object.keys(process.env).filter(k => k.includes("POSTGRES")));
}

import { db } from "./src/lib/db";
import { sql } from "drizzle-orm";

async function diagnose() {
    console.log("--- Diagnóstico de Base de Datos ---");
    try {
        // Verificar conectividad simple
        const resultTime = await db.execute(sql`SELECT NOW()`);
        console.log("Conexión exitosa. Hora del servidor DB:", resultTime.rows[0]);

        // Verificar tablas
        const resultTables = await db.execute(sql`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`);
        console.log("Tablas encontradas:", JSON.stringify(resultTables.rows, null, 2));

        if (resultTables.rows.length === 0) {
            console.warn("ADVERTENCIA: No se encontraron tablas en el esquema público.");
        }
    } catch (error) {
        console.error("ERROR de conectividad o consulta:", error);
    }
}

diagnose();
