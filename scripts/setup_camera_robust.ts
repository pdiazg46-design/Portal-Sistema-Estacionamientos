
import fs from "fs";
import path from "path";

// 1. Manual Env Loading
const envPath = path.join(process.cwd(), '.env.local');
console.log("Loading .env.local from:", envPath);

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...params] = line.split('=');
        if (key && params.length > 0) {
            const val = params.join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
            process.env[key.trim()] = val;
        }
    });
    console.log("Env loaded manually.");
} else {
    console.error("No .env.local found!");
}

// 2. Main Logic
async function main() {
    // Dynamic import to ensure env is set
    const { db } = await import("../src/lib/db");
    const { cameras, accesses } = await import("../src/lib/schema");
    const { eq } = await import("drizzle-orm");

    console.log("Connecting to DB...");

    // 1. Get Access (Puerta 1)
    const allAccesses = await db.select().from(accesses);
    const gate1 = allAccesses.find(a => a.name.includes("1") || a.id === "gate-a") || allAccesses[0];

    if (!gate1) {
        console.error("❌ No access found.");
        return;
    }
    console.log(`📍 Using Access: ${gate1.name} (ID: ${gate1.id})`);

    // 2. Upsert Camera
    const testCameraName = "Camara_Prueba_ANPR";
    const existing = await db.select().from(cameras).where(eq(cameras.deviceName, testCameraName)).then(res => res[0]);

    if (existing) {
        console.log(`✅ Camera '${testCameraName}' ALREADY EXISTS.`);
        if (existing.accessId !== gate1.id) {
            console.log(`⚠️ Updating Camera Access to ${gate1.id}`);
            await db.update(cameras).set({ accessId: gate1.id }).where(eq(cameras.deviceName, testCameraName));
        }
    } else {
        console.log(`✨ Creating Camera '${testCameraName}'...`);
        await db.insert(cameras).values({
            id: crypto.randomUUID(),
            deviceName: testCameraName,
            accessId: gate1.id,
            type: "BOTH"
        });
        console.log(`✅ Camera Created.`);
    }

    console.log("Done.");
}

main().catch(console.error);
