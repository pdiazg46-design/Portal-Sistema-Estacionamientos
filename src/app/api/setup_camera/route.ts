
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cameras, accesses } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    try {
        console.log("[SetupAPI] Starting setup...");

        // 1. Check Accesses
        const allAccesses = await db.select().from(accesses);
        console.log(`[SetupAPI] Found ${allAccesses.length} accesses.`);

        let gate1 = allAccesses.find((a: any) => a.name.toLowerCase().includes("puerta 1") || a.id === "gate-a");
        if (!gate1) {
            // Fallback or create? 
            if (allAccesses.length > 0) {
                gate1 = allAccesses[0];
                console.log("[SetupAPI] Puerta 1 not found, using first available:", gate1.name);
            } else {
                return NextResponse.json({ success: false, error: "No accesses found in DB." }, { status: 404 });
            }
        }

        // 2. Setup Camera
        const testCameraName = "Camara_Prueba_ANPR";
        // Fix: cast to any for proper drizzle usage with 'any' schema
        const existingCam = await db.select().from(cameras).where(eq(cameras.deviceName as any, testCameraName)).then((res: any) => res[0]);

        let action = "none";
        if (existingCam) {
            if (existingCam.accessId !== gate1.id) {
                await db.update(cameras).set({ accessId: gate1.id }).where(eq(cameras.deviceName as any, testCameraName));
                action = "updated_access";
            } else {
                action = "already_correct";
            }
        } else {
            await db.insert(cameras).values({
                id: crypto.randomUUID(),
                deviceName: testCameraName,
                accessId: gate1.id,
                type: "BOTH"
            });
            action = "created";
        }

        return NextResponse.json({
            success: true,
            action,
            camera: testCameraName,
            gate: gate1.name,
            gateId: gate1.id
        });

    } catch (error) {
        console.error("[SetupAPI] Error:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
