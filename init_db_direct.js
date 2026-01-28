
const { Client } = require('pg');

const client = new Client({
    connectionString: "postgres://default:o8uN2LzBeoPk@ep-delicate-meadow-a4nre90b-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require"
});

async function run() {
    console.log("Conectando a Vercel Postgres directamente...");
    try {
        await client.connect();
        console.log("Conectado exitosamente.");

        const queries = [
            `CREATE TABLE IF NOT EXISTS accesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`,
            `CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL UNIQUE,
        access_id TEXT NOT NULL REFERENCES accesses(id),
        type TEXT NOT NULL
      )`,
            `CREATE TABLE IF NOT EXISTS parking_spots (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        access_id TEXT REFERENCES accesses(id),
        tower_id TEXT NOT NULL DEFAULT 'T1',
        type TEXT NOT NULL,
        is_occupied BOOLEAN NOT NULL DEFAULT false,
        reserved_for_id TEXT,
        monthly_fee INTEGER
      )`,
            `CREATE TABLE IF NOT EXISTS staff_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        license_plate TEXT NOT NULL UNIQUE,
        phone_number TEXT,
        assigned_spot_id INTEGER REFERENCES parking_spots(id),
        vacation_start TIMESTAMP,
        vacation_end TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS parking_records (
        id TEXT PRIMARY KEY,
        license_plate TEXT NOT NULL,
        entry_access_id TEXT REFERENCES accesses(id),
        exit_access_id TEXT REFERENCES accesses(id),
        tower_id TEXT NOT NULL DEFAULT 'T1',
        entry_time TIMESTAMP NOT NULL DEFAULT now(),
        exit_time TIMESTAMP,
        spot_id INTEGER REFERENCES parking_spots(id),
        entry_type TEXT NOT NULL,
        cost INTEGER
      )`,
            `CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      )`,
            `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        access_id TEXT REFERENCES accesses(id),
        role TEXT NOT NULL DEFAULT 'OPERATOR',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )`
        ];

        for (const q of queries) {
            console.log(`Ejecutando: ${q.substring(0, 50)}...`);
            await client.query(q);
        }

        console.log("Tablas inicializadas. Insertando datos base...");
        await client.query("INSERT INTO accesses (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['gate-a', 'Acceso Principal']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['price_per_minute', '25']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['charging_enabled', 'true']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['company_name', 'Mi Estacionamiento']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['system_name', 'Gestión de Estacionamientos']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['description', 'Sistema de Control de Acceso Vehicular']);
        await client.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING", ['install_date', Math.floor(Date.now() / 1000).toString()]);

        console.log("Creando usuario administrador...");
        await client.query(`
      INSERT INTO users (id, username, password, email, role) 
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, ['admin-init', 'Pdiaz', 'Pdiaz8249', 'pdiazg46@gmail.com', 'ADMIN']);

        console.log("--- INICIALIZACIÓN COMPLETADA CON ÉXITO ---");
    } catch (err) {
        console.error("Fallo durante la inicialización:", err);
        console.error("Detalles del error:", JSON.stringify(err, null, 2));
    } finally {
        await client.end();
    }
}

run();
