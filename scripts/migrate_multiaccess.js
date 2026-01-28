const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'parking.db');
const db = new Database(dbPath);

console.log('--- Iniciando Migración Multi-Acceso ---');

try {
    db.transaction(() => {
        // 1. Crear tabla accesses
        db.exec(`
            CREATE TABLE IF NOT EXISTS accesses (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            );
        `);
        console.log('✅ Tabla "accesses" preparada');

        // 2. Crear tabla cameras
        db.exec(`
            CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                device_name TEXT UNIQUE NOT NULL,
                access_id TEXT NOT NULL REFERENCES accesses(id),
                type TEXT NOT NULL
            );
        `);
        console.log('✅ Tabla "cameras" preparada');

        // 3. Añadir access_id a users
        try { db.exec('ALTER TABLE users ADD COLUMN access_id TEXT REFERENCES accesses(id);'); } catch (e) { }

        // 4. Añadir access_id a parking_spots
        try { db.exec('ALTER TABLE parking_spots ADD COLUMN access_id TEXT REFERENCES accesses(id);'); } catch (e) { }

        // 5. Añadir columnas de acceso a parking_records
        try { db.exec('ALTER TABLE parking_records ADD COLUMN entry_access_id TEXT REFERENCES accesses(id);'); } catch (e) { }
        try { db.exec('ALTER TABLE parking_records ADD COLUMN exit_access_id TEXT REFERENCES accesses(id);'); } catch (e) { }

        console.log('✅ Columnas de relación añadidas');
    })();
} catch (e) {
    console.error('❌ Error en migración:', e.message);
}

db.close();
console.log('--- Migración Finalizada ---');
