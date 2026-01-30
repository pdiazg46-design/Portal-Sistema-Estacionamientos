
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cameras, accesses } from '@/lib/schema';

export async function GET() {
    try {
        const allAccesses = await db.select().from(accesses);
        const allCameras = await db.select().from(cameras);

        return NextResponse.json({
            success: true,
            accesses: allAccesses,
            cameras: allCameras
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
