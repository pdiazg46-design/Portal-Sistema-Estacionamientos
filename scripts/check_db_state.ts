
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

async function main() {
    try {
        // 1. Force load .env.local BEFORE importing db
        const envPath = path.join(process.cwd(), '.env.local');
        console.log("Loading env from:", envPath);
        dotenv.config({ path: envPath });

        if (!process.env.POSTGRES_URL) {
            throw new Error("POSTGRES_URL not found in .env.local");
        }
        console.log("Env loaded. POSTGRES_URL present.");

        // 2. Dynamic Import
        const { db } = await import("../src/lib/db");
        const { cameras, accesses } = await import("../src/lib/schema");

        console.log("Connecting to DB...");

        const allAccesses = await db.select().from(accesses);
        console.log("Accesses fetched:", allAccesses.length);

        const allCameras = await db.select().from(cameras);
        console.log("Cameras fetched:", allCameras.length);

        const output = {
            accesses: allAccesses,
            cameras: allCameras
        };

        const outputPath = path.join(process.cwd(), "scripts", "db_state_output.json");
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log("Written to " + outputPath);
    } catch (e) {
        console.error("Error:", e);
        const errorPath = path.join(process.cwd(), "scripts", "db_state_error.txt");
        fs.writeFileSync(errorPath, String(e));
    }
}

main();
