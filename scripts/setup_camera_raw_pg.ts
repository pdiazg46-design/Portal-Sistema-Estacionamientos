
import { Client } from 'pg';
import fs from "fs";
import path from "path";

// 1. Load Env
const envPath = path.join(process.cwd(), '.env.local');
let connectionString = process.env.POSTGRES_URL;

if (!connectionString && fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...params] = line.split('=');
        if (key && key.trim() === 'POSTGRES_URL') {
            connectionString = params.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

if (!connectionString) {
    console.error("❌ Could not find POSTGRES_URL in .env.local");
    process.exit(1);
}

// 2. Connect
const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false } // Vercel/Neon often needs this
});

async function main() {
    try {
        await client.connect();
        console.log("✅ Connected to DB via pg");

        // 3. Find Gate
        const resGates = await client.query('SELECT * FROM accesses');
        const gates = resGates.rows;
        let gate1 = gates.find(g => g.name.toLowerCase().includes("puerta 1") || g.id === "gate-a") || gates[0];

        if (!gate1) {
            console.error("❌ No gate found");
            return;
        }
        console.log(`📍 Using Gate: ${gate1.name} (${gate1.id})`);

        // 4. Upsert Camera
        const camName = "Camara_Prueba_ANPR";
        const resCam = await client.query('SELECT * FROM cameras WHERE device_name = $1', [camName]);

        if (resCam.rows.length > 0) {
            console.log("⚠️ Camera exists. Updating access...");
            await client.query('UPDATE cameras SET access_id = $1 WHERE device_name = $2', [gate1.id, camName]);
            console.log("✅ Camera updated.");
        } else {
            console.log("✨ Creating camera...");
            const id = crypto.randomUUID();
            await client.query('INSERT INTO cameras (id, device_name, access_id, type) VALUES ($1, $2, $3, $4)', [id, camName, gate1.id, 'BOTH']);
            console.log("✅ Camera created.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await client.end();
    }
}

main();
