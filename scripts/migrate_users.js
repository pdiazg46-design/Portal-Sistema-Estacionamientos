const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'parking.db');
const db = new Database(dbPath);

console.log('Migrando base de datos para usuarios...');

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'OPERATOR',
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
    `);
    console.log('✅ Tabla "users" creada o ya existe');
} catch (e) {
    console.error('❌ Error creando tabla users:', e.message);
}

db.close();
console.log('Migración de usuarios finalizada.');
