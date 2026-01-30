import { createPool } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";
import * as schema from "./schema";
import { sql } from "@vercel/postgres";

// Buscar cualquier variable de conexión disponible
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Helper to determine mode
const isProd = !!process.env.POSTGRES_URL;

let dbInstance;

if (isProd) {
    dbInstance = drizzle(sql, { schema });
} else {
    // Fallback: Local SQLite (Hybrid Mode)
    console.warn("⚠️ NO POSTGRES_URL FOUND. Using Local SQLite (parking.db).");
    try {
        // Use eval("require") to prevent Webpack from trying to bundle these native modules
        const requireFunc = eval("require");
        const Database = requireFunc('better-sqlite3');
        const { drizzle: drizzleSqlite } = requireFunc('drizzle-orm/better-sqlite3');

        const sqlite = new Database('parking.db');
        // Casting schema to any to bypass strict driver mismatch types temporarily
        dbInstance = drizzleSqlite(sqlite, { schema: schema as any });

        // Initialize tables if empty (Basic Check)
        const check = sqlite.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='cameras'").get();
        if (check.count === 0) {
            console.log("⚠️ Tables missing in parking.db. Please run migrations.");
            // We could run raw SQL here to create tables if needed
        }
    } catch (e) {
        console.error("❌ Failed to initialize SQLite fallback:", e);
        // Fallback to avoid crash on import, but queries will fail
        dbInstance = {
            select: () => ({ from: () => ({ all: () => [], where: () => ({ all: () => [] }) }) }),
            // Add other methods as needed to prevent immediate crash
        } as any;
    }
}

export const db = dbInstance;
