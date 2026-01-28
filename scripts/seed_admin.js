const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'parking.db');
const db = new Database(dbPath);

console.log('Seeding Super Admin...');

const superAdmin = {
    id: crypto.randomUUID(),
    username: 'Pdiaz',
    password: 'Pdiaz8249',
    role: 'SUPER_ADMIN'
};

try {
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(superAdmin.username);
    if (existing) {
        db.prepare('UPDATE users SET password = ?, role = ? WHERE username = ?')
            .run(superAdmin.password, superAdmin.role, superAdmin.username);
        console.log('✅ Super Admin actualizado');
    } else {
        db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)')
            .run(superAdmin.id, superAdmin.username, superAdmin.password, superAdmin.role);
        console.log('✅ Super Admin creado');
    }
} catch (e) {
    console.error('❌ Error seeding Super Admin:', e.message);
}

db.close();
console.log('Seed de Super Admin finalizado.');
