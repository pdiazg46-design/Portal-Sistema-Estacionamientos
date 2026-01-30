
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parkingSpots, parkingRecords } from '@/lib/schema';
import { desc, isNull } from 'drizzle-orm';

export async function GET() {
    try {
        const spots = await db.select().from(parkingSpots);
        const occupiedCount = spots.filter((s: any) => s.isOccupied).length;

        const lastRecords = await db.select()
            .from(parkingRecords)
            .orderBy(desc(parkingRecords.entryTime))
            .limit(5);

        const activeRecords = await db.select()
            .from(parkingRecords)
            .where(isNull(parkingRecords.exitTime));

        return NextResponse.json({
            success: true,
            stats: {
                totalSpots: spots.length,
                occupiedSpots: occupiedCount,
                activeRecordsCount: activeRecords.length
            },
            spots: spots.filter((s: any) => s.isOccupied).map((s: any) => ({ id: s.id, code: s.code })),
            last5Records: lastRecords,
            activeRecords: activeRecords
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
}
