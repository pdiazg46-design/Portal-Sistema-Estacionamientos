
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    const diagnostics = {
        env: {
            POSTGRES_URL: process.env.POSTGRES_URL ? "Presente (Definida)" : "Faltante (No definida)",
            NODE_ENV: process.env.NODE_ENV
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
