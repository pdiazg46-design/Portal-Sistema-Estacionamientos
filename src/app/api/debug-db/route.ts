
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = "force-dynamic";

// Last forced update: 2026-01-28 20:25
export async function GET() {
    const mask = (str: string | undefined) => str ? `${str.substring(0, 8)}...` : "Faltante";

    const diagnostics = {
        env: {
            POSTGRES_URL: mask(process.env.POSTGRES_URL),
            DATABASE_URL: mask(process.env.DATABASE_URL),
            NODE_ENV: process.env.NODE_ENV,
            ver: "1.0.5" // Forzar actualización
        },
        connection: "Pendiente"
    };

    try {
        await db.execute(sql`SELECT 1`);
        diagnostics.connection = "Exitosa ✅";
    } catch (error) {
        diagnostics.connection = `Falló ❌: ${error instanceof Error ? error.message : "Error desconocido"}`;
    }

    return NextResponse.json(diagnostics);
}
