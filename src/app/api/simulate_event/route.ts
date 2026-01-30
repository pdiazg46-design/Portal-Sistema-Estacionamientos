
import { NextResponse } from 'next/server';
import { processVehicleEntry, getAvailableGeneralSpots, occupySpot } from '@/lib/actions';

export async function GET() {
    try {
        console.log("[Simulation] Triggering test entry...");

        // 1. Simulate a car approaching (Logic Check)
        const plate = "TEST-" + Math.floor(Math.random() * 1000);
        let result = await processVehicleEntry(plate, "gate-a");

        // 2. If it's a visitor (unknown car), usually a Guard would manually assign a spot.
        // For this SIMULATION, we will perform that "Guard Action" automatically to ensure it shows on Dashboard.
        let assignedSpotCode = "NINGUNO";

        if (!result.allowed) {
            const availableSpots = await getAvailableGeneralSpots("gate-a");
            if (availableSpots.length > 0) {
                const spotToAssign = availableSpots[0]; // First sequential spot
                await occupySpot(spotToAssign.id, plate, "MANUAL", "gate-a");

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
            message: `ÉXITO: El auto ${plate} ha ingresado al sitio ${assignedSpotCode}. Revisa el Dashboard.`
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        }, { status: 500 });
    }
}
