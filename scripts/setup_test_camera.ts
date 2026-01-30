
import { db } from "../src/lib/db";
import { cameras, accesses } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function main() {
    // 1. Identificar el primer acceso disponible como "Puerta 1" 
    const allAccesses = await db.select().from(accesses).all();
    const gate1 = allAccesses.find(a => a.name.includes("1") || a.id === "gate-a") || allAccesses[0];

    if (!gate1) {
        console.error("❌ No se encontró ningún acceso (Puerta) configurado en la base de datos.");
        return;
    }

    console.log(`📍 Vinculando cámara de prueba a: ${gate1.name} (ID: ${gate1.id})`);

    // 2. Definir el nombre de la cámara que Sergio configurará
    const testCameraName = "Camara_Prueba_ANPR";

    // 3. Upsert de la cámara (insertar o actualizar si ya existe)
    // Buscamos si ya existe una cámara con ese nombre
    const existing = await db.select().from(cameras).where(eq(cameras.deviceName, testCameraName)).get();

    if (existing) {
        await db.update(cameras)
            .set({ accessId: gate1.id, type: "BOTH" })
            .where(eq(cameras.deviceName, testCameraName));
        console.log(`✅ Cámara '${testCameraName}' actualizada como BI-DIRECCIONAL en ${gate1.name}`);
    } else {
        await db.insert(cameras).values({
            id: crypto.randomUUID(),
            deviceName: testCameraName,
            accessId: gate1.id,
            type: "BOTH"
        });
        console.log(`✅ Cámara '${testCameraName}' creada como BI-DIRECCIONAL en ${gate1.name}`);
    }
}

main().catch(console.error);
