
import { db } from "../src/lib/db";
import { accesses } from "../src/lib/schema";
import Database from 'better-sqlite3';

async function main() {
    console.log("🔍 Debugging SQLite/Drizzle...");

    // 1. Raw SQLite Check
    try {
        const rawDb = new Database('parking.db');
        const count = rawDb.prepare("SELECT count(*) as count FROM accesses").get();
        console.log("Raw SQLite Count:", count);
        const rows = rawDb.prepare("SELECT * FROM accesses").all();
        console.log("Raw SQLite Rows:", rows);
    } catch (e) {
        console.error("Raw SQLite Error:", e);
    }

    // 2. Drizzle Check
    try {
        console.log("Testing Drizzle Query...");
        const result = await db.select().from(accesses);
        console.log("Drizzle Result Protocol:", result);
    } catch (e) {
        console.error("Drizzle Error:", e);
    }
}

main();
