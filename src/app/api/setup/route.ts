
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export const dynamic = "force-dynamic";

// Last forced update: 2026-01-28 20:49
export async function GET() {
  try {
    console.log("[Setup] Inciando creación de tablas...");

    // ... (rest of the file remains the same until return)

    // 1. Crear Tablas
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

    console.log("[Setup] Tablas creadas. Insertando datos iniciales...");

    // 2. Datos base (Saneamiento Total: Solo puertas 1, 2 y 3)
    console.log("[Setup] Limpiando accesos antiguos...");

    // Primero desvinculamos referencias para evitar errores de Foreign Key
    await db.execute(sql`UPDATE users SET access_id = NULL WHERE access_id = 'gate-a'`);
    await db.execute(sql`UPDATE parking_spots SET access_id = NULL WHERE access_id = 'gate-a'`);
    await db.execute(sql`UPDATE parking_records SET entry_access_id = NULL WHERE entry_access_id = 'gate-a'`);
    await db.execute(sql`UPDATE parking_records SET exit_access_id = NULL WHERE exit_access_id = 'gate-a'`);

    // Si hay cámaras, las movemos temporalmente a la Puerta 1
    await db.execute(sql`INSERT INTO accesses (id, name) VALUES ('gate-1', 'Puerta 1') ON CONFLICT DO NOTHING`);
    await db.execute(sql`UPDATE cameras SET access_id = 'gate-1' WHERE access_id = 'gate-a'`);

    // Ahora sí, eliminamos el Acceso Principal definitivamente
    await db.execute(sql`DELETE FROM accesses WHERE id = 'gate-a'`);

    // Aseguramos las otras puertas
    await db.execute(sql`INSERT INTO accesses (id, name) VALUES ('gate-2', 'Puerta 2') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO accesses (id, name) VALUES ('gate-3', 'Puerta 3') ON CONFLICT DO NOTHING`);

    // Vincular estacionamientos existentes a sus puertas correspondientes
    await db.execute(sql`UPDATE parking_spots SET access_id = 'gate-1' WHERE tower_id = 'T1'`);
    await db.execute(sql`UPDATE parking_spots SET access_id = 'gate-2' WHERE tower_id = 'T2'`);
    await db.execute(sql`UPDATE parking_spots SET access_id = 'gate-3' WHERE tower_id = 'T3'`);

    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('price_per_minute', '25') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('charging_enabled', 'true') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('company_name', 'Mi Estacionamiento') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('system_name', 'Gestión de Estacionamientos') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('description', 'Sistema de Control de Acceso Vehicular') ON CONFLICT DO NOTHING`);
    await db.execute(sql`INSERT INTO settings (key, value) VALUES ('install_date', ${Math.floor(Date.now() / 1000).toString()}) ON CONFLICT DO NOTHING`);

    // 3. Usuario Admin
    await db.execute(sql`
      INSERT INTO users (id, username, password, email, role, access_id) 
      VALUES ('admin-init', 'Pdiaz', 'Pdiaz8249', 'pdiazg46@gmail.com', 'SUPER_ADMIN', NULL)
      ON CONFLICT (username) DO UPDATE SET role = 'SUPER_ADMIN', access_id = NULL
    `);

    revalidatePath('/');

    return NextResponse.json({
      success: true,
      message: "Base de datos inicializada correctamente. Ya puedes volver al inicio."
    });

  } catch (error) {
    console.error("[Setup Error]:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 });
  }
}
