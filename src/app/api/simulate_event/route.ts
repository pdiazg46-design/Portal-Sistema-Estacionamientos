
import { NextResponse } from 'next/server';
import { processVehicleEntry } from '@/lib/actions';

export async function GET() {
    try {
        console.log("[Simulation] Triggering test entry...");

        // Simulate a car entering Gate 1
        const plate = "TEST-" + Math.floor(Math.random() * 1000);
        const result = await processVehicleEntry(plate, "gate-a");

        return NextResponse.json({
            success: true,
            test_plate: plate,
            result: result,
            message: "Si ves este mensaje, la base de datos y la lógica funcionan. Revisa el Dashboard."
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }, { status: 500 });
    }
}
