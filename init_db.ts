
import dotenv from "dotenv";
import path from "path";
const envPath = path.resolve(process.cwd(), ".env.production");
dotenv.config({ path: envPath });

import { db } from "./src/lib/db";
import { sql } from "drizzle-orm";

async function init() {
    console.log("--- Iniciando Inicialización Manual de DB ---");
    console.log("URL de conexión presente:", !!process.env.POSTGRES_URL);

    try {
        // 1. Crear Tablas en orden de dependencia
        console.log("Creando tablas...");

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS accesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL UNIQUE,
        access_id TEXT NOT NULL REFERENCES accesses(id),
        type TEXT NOT NULL
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parking_spots (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL,
        access_id TEXT REFERENCES accesses(id),
        tower_id TEXT NOT NULL DEFAULT 'T1',
        type TEXT NOT NULL,
        is_occupied BOOLEAN NOT NULL DEFAULT false,
        reserved_for_id TEXT,
        monthly_fee INTEGER
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        license_plate TEXT NOT NULL UNIQUE,
        phone_number TEXT,
        assigned_spot_id INTEGER REFERENCES parking_spots(id),
        vacation_start TIMESTAMP,
        vacation_end TIMESTAMP
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parking_records (
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
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );
    `);

        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        access_id TEXT REFERENCES accesses(id),
        role TEXT NOT NULL DEFAULT 'OPERATOR',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

        console.log("Tablas creadas exitosamente.");

        // 2. Insertar Datos Base
        console.log("Insertando datos iniciales...");

        await db.execute(sql`
      INSERT INTO accesses (id, name) VALUES ('gate-a', 'Acceso Principal') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('price_per_minute', '25') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('charging_enabled', 'true') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('company_name', 'Mi Estacionamiento') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('system_name', 'Gestión de Estacionamientos') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('description', 'Sistema de Control de Acceso Vehicular') ON CONFLICT DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('install_date', ${Math.floor(Date.now() / 1000).toString()}) ON CONFLICT DO NOTHING;
    `);

        // 3. Crear Usuario Admin
        await db.execute(sql`
      INSERT INTO users (id, username, password, email, role) 
      VALUES ('admin-init', 'Pdiaz', 'Pdiaz8249', 'pdiazg46@gmail.com', 'ADMIN')
      ON CONFLICT DO NOTHING;
    `);

        console.log("--- Inicialización Completada con ÉXITO ---");
    } catch (error) {
        console.error("CRITICAL ERROR durante la inicialización:", error);
    }
}

init();
