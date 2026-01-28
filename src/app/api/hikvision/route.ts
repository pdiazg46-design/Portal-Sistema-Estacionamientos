import { NextResponse } from 'next/server';
import { processVehicleEntry, processVehicleExit, occupySpot, getAvailableGeneralSpots } from '@/lib/actions';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { cameras, accesses } from '@/lib/schema';

/**
 * INTEGRACIÓN HIKCENTRAL - ANPR (LPR)
 * 
 * Este endpoint recibe las notificaciones de eventos de HikCentral.
 * Configuración en HikCentral:
 * 1. Event & Alarm -> Alarm Host -> Agregar la URL de este endpoint.
 * 2. Event & Alarm -> Event Config -> Vehicle -> Plate Captured.
 * 3. Linkage Method -> Notify Alarm Host.
 */

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      console.log('[Hikvision] Raw Body (Not JSON):', bodyText);
      // Si es XML (común en cámaras antiguas), aquí podrías ver el contenido
      return NextResponse.json({ success: false, error: "Formato no reconocido (posiblemente XML)", raw: bodyText.substring(0, 500) }, { status: 400 });
    }

    console.log('[Hikvision] Payload received:', JSON.stringify(payload, null, 2));

    let plateNumber = "";
    let deviceName = "";

    // Estrategia de detección de formato (Detective Debugging Applied)

    // 1. Formato HikCentral
    if (payload.data?.eventInfo || payload.eventInfo) {
      console.log('[Hikvision] Format detected: HikCentral');
      const eventInfo = payload.data?.eventInfo || payload.eventInfo;
      plateNumber = eventInfo.plateNumber || eventInfo.licensePlate || eventInfo.plate_number;
      deviceName = eventInfo.deviceName || eventInfo.device_name || "";
    }
    // 2. Formato Cámara Directa (ISAPI/HTTP Push)
    else if (payload.EventNotificationAlert) {
      console.log('[Hikvision] Format detected: Direct Camera (ISAPI)');
      const alert = payload.EventNotificationAlert;
      // Buscamos en ANPR o anpr
      const anpr = alert.ANPR || alert.anpr || {};
      plateNumber = anpr.licensePlate || anpr.plateNo || anpr.plateNumber;

      // Fallback a extension info
      if (!plateNumber && alert.extensionInfo) {
        plateNumber = alert.extensionInfo.plateNumber || alert.extensionInfo.licensePlate;
      }

      deviceName = alert.deviceName || alert.device_name || "Camara_Directa";
    }
    // 3. Formato Genérico / Otros
    else {
      console.log('[Hikvision] Format detected: Generic/Other');
      plateNumber = payload.plateNumber || payload.licensePlate || payload.plate_number || payload.PlateNumber || payload.LicensePlate;
      deviceName = payload.deviceName || payload.device_name || payload.DeviceName || "Unknown_Device";
    }

    if (!plateNumber) {
      console.warn("[Hikvision] No se encontró patente en el payload después de intentar múltiples formatos.");
      console.warn("[Hikvision] Estructura recibida keys:", Object.keys(payload));
      return NextResponse.json({ success: false, error: "No se encontró patente en el payload" }, { status: 400 });
    }

    // normalizar patente
    const normalizedPlate = plateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 4. Búsqueda en tabla de Cámaras
    const camResults = (await db.select({
      camera: cameras,
      access: accesses
    })
      .from(cameras)
      .innerJoin(accesses, eq(cameras.accessId, accesses.id))
      .where(eq(cameras.deviceName, deviceName)))[0];

    // Variables de decisión
    let finalAccessId = camResults?.access.id;
    let cameraType = camResults?.camera.type; // "ENTRY" o "EXIT"

    // Fallback Manual basado en nombre (Solo si la cámara no está en DB)
    if (!camResults) {
      console.warn(`[Hikvision] Cámara '${deviceName}' no está en la base de datos de mapeo.`);
      const isEntry = deviceName.toUpperCase().includes("ENTRADA") || deviceName.toUpperCase().includes("ENTRY");
      const isExit = deviceName.toUpperCase().includes("SALIDA") || deviceName.toUpperCase().includes("EXIT");

      if (isEntry) cameraType = "ENTRY" as any;
      if (isExit) cameraType = "EXIT" as any;
      // Por defecto asignamos gate-a si no sabemos cuál es
      finalAccessId = "gate-a";
    }

    if (cameraType === "ENTRY") {
      console.log(`[ANPR] Detectado ingreso en ${camResults?.access.name || 'Desconocido'}: ${normalizedPlate}`);

      const result = await processVehicleEntry(normalizedPlate, finalAccessId || "gate-a");

      if (result.allowed) {
        return NextResponse.json({
          success: true,
          message: `Acceso concedido a Abonado: ${normalizedPlate} en ${camResults?.access.name}`,
          details: result
        });
      } else {
        const availableGeneralSpots = await getAvailableGeneralSpots(finalAccessId);
        if (availableGeneralSpots.length > 0) {
          const spot = availableGeneralSpots[0];
          await occupySpot(spot.id, normalizedPlate, "AUTOMATIC", finalAccessId);
          return NextResponse.json({
            success: true,
            message: `Acceso concedido a Visita: ${normalizedPlate} en ${camResults?.access.name}. Sitio ${spot.code}`,
            spot: spot.code
          });
        }

        return NextResponse.json({
          success: false,
          message: `No hay sitios disponibles en ${camResults?.access.name} para: ${normalizedPlate}`,
          details: result
        });
      }
    }

    if (cameraType === "EXIT") {
      console.log(`[ANPR] Detectado salida en ${camResults?.access.name || 'Desconocido'}: ${normalizedPlate}`);
      const exitResult = await processVehicleExit(normalizedPlate, finalAccessId || "gate-a");
      return NextResponse.json({
        success: exitResult.success,
        message: exitResult.message + ` (Salida por ${camResults?.access.name || 'Desconocido'})`,
        cost: exitResult.cost
      });
    }

    return NextResponse.json({
      success: true,
      message: "Evento recibido pero la cámara no está configurada como ENTRY o EXIT",
      plate: normalizedPlate,
      camera: deviceName
    });

  } catch (error) {
    console.error('[HikCentral Error]:', error);
    return NextResponse.json({
      success: false,
      error: "Error interno procesando evento LPR",
      details: error instanceof Error ? error.message : "Undefined error"
    }, { status: 500 });
  }
}

// Opcional: GET para verificar que el servicio está activo
export async function GET() {
  return NextResponse.json({
    status: "active",
    service: "HikCentral LPR Integration",
    integration_endpoint: "/api/hikvision"
  });
}
