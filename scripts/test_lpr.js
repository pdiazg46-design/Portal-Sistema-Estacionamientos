/**
 * SCRIPT DE PRUEBA PARA INTEGRACIÓN HIKVISION ANPR
 * 
 * Este script simula el envío de un evento de lectura de patente 
 * desde HikCentral Professional hacia el sistema de estacionamiento.
 */


const IP_SERVIDOR = 'http://localhost:3000'; // Ajustar si el puerto es distinto
const ENDPOINT = `${IP_SERVIDOR}/api/hikvision`;

async function enviarEvento(patente, nombreCamara) {
    const payload = {
        eventInfo: {
            plateNumber: patente,
            deviceName: nombreCamara,
            eventTime: new Date().toISOString()
        }
    };

    console.log(`\n🚀 Enviando Evento: [${nombreCamara}] Detectó Patente: ${patente}`);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('✅ Respuesta del Servidor:', data);
    } catch (error) {
        console.error('❌ Error enviando evento:', error.message);
    }
}

// SIMULACIONES
async function runTests() {
    console.log('--- INICIANDO PRUEBAS DE INTEGRACIÓN LPR ---');

    // 1. Simular Entrada de una Visita
    await enviarEvento('VISITA-123', 'CAMARA_ENTRADA_01');

    // 2. Esperar un poco
    await new Promise(r => setTimeout(r, 2000));

    // 3. Simular Salida de esa Visita
    await enviarEvento('VISITA-123', 'CAMARA_SALIDA_01');

    console.log('\n--- PRUEBAS FINALIZADAS ---');
    console.log('Revisa el panel de control para ver los cambios reflejados.');
}

runTests();
