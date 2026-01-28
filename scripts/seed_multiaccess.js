const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'parking.db');
const db = new Database(dbPath);

console.log('Seeding Multi-Access Data...');

const gates = [
    { id: 'gate-a', name: 'Acceso A' },
    { id: 'gate-b', name: 'Acceso B' },
    { id: 'gate-c', name: 'Acceso C' }
];

const cameras = [
    { id: crypto.randomUUID(), deviceName: 'CAM_ENTRADA_A', accessId: 'gate-a', type: 'ENTRY' },
    { id: crypto.randomUUID(), deviceName: 'CAM_SALIDA_A', accessId: 'gate-a', type: 'EXIT' },
    { id: crypto.randomUUID(), deviceName: 'CAM_ENTRADA_B', accessId: 'gate-b', type: 'ENTRY' },
    { id: crypto.randomUUID(), deviceName: 'CAM_SALIDA_B', accessId: 'gate-b', type: 'EXIT' },
    { id: crypto.randomUUID(), deviceName: 'CAM_ENTRADA_C', accessId: 'gate-c', type: 'ENTRY' },
    { id: crypto.randomUUID(), deviceName: 'CAM_SALIDA_C', accessId: 'gate-c', type: 'EXIT' }
];

try {
    db.transaction(() => {
        // Seed gates
        const insertGate = db.prepare('INSERT OR IGNORE INTO accesses (id, name) VALUES (?, ?)');
        for (const gate of gates) {
            insertGate.run(gate.id, gate.name);
        }
        console.log('✅ Portones (Accesses) creados');

        // Seed cameras
        const insertCamera = db.prepare('INSERT OR IGNORE INTO cameras (id, device_name, access_id, type) VALUES (?, ?, ?, ?)');
        for (const cam of cameras) {
            insertCamera.run(cam.id, cam.deviceName, cam.accessId, cam.type);
        }
        console.log('✅ Cámaras (6) configuradas');

        // Asignar todos los sitios existentes a Puerta A por defecto para no romper el sistema actual
        db.prepare("UPDATE parking_spots SET access_id = 'gate-a' WHERE access_id IS NULL").run();
        console.log('✅ Sitios existentes vinculados al Acceso A');
    })();
} catch (e) {
    console.error('❌ Error seeding multi-access:', e.message);
}

db.close();
console.log('Seed Multi-Access finalizado.');
