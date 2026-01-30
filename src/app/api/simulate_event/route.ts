
import { NextResponse } from 'next/server';
import { processVehicleEntry, getAvailableGeneralSpots, occupySpot } from '@/lib/actions';
import { db } from '@/lib/db';
import { accesses } from '@/lib/schema';

export async function GET() {
    try {
        console.log("[Simulation] Triggering test entry...");

        // 0. Get a VALID Access ID (Dynamic)
        // Hardcoding 'gate-a' causes FK errors if the DB has 'gate-1'.
        const allAccesses = await db.select().from(accesses);
        const gate1 = allAccesses.find((a: any) => a.name.toLowerCase().includes("puerta 1") || a.id === "gate-a" || a.id === "gate-1") || allAccesses[0];

        if (!gate1) {
            return NextResponse.json({
                success: false,
                error: "No se encontró ninguna Puerta (Access) en la base de datos para simular el ingreso."
            }, { status: 500 });
        }

        const validAccessId = gate1.id;

        // 1. Simulate a car approaching
        const plate = "TEST-" + Math.floor(Math.random() * 1000);
        let result = await processVehicleEntry(plate, validAccessId);

        // 2. If it's a visitor (unknown car), force occupy
        let assignedSpotCode = "NINGUNO";

        if (!result.allowed) {
            const availableSpots = await getAvailableGeneralSpots(validAccessId);
            if (availableSpots.length > 0) {
                const spotToAssign = availableSpots[0]; // First sequential spot
                await occupySpot(spotToAssign.id, plate, "MANUAL", validAccessId);

                assignedSpotCode = spotToAssign.code;
                result = {
                    ...result,
                    allowed: true,
                    message: "Simulación: Guardia aprobó ingreso manual.",
                    spot: spotToAssign
                };
            } else {
                return NextResponse.json({
                    success: false,
                    error: "No hay sitios disponibles para la simulación."
                }, { status: 400 });
            }
        } else {
            assignedSpotCode = result.spot?.code || "AUTO";
        }

        return NextResponse.json({
            success: true,
            test_plate: plate,
            result: result,
            assigned_spot: assignedSpotCode,
            used_gate: gate1.name, // Return for debug
            message: `ÉXITO: El auto ${plate} ha ingresado al sitio ${assignedSpotCode}. Revisa el Dashboard.`
        });

    } catch (error) {
        console.error("[Simulation Error]", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido",
            details: JSON.stringify(error)
        }, { status: 500 });
    }
}
