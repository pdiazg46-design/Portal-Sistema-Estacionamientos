
import ParkingGrid from "@/components/ParkingGrid";
import { getPricePerMinute, isChargingEnabled, getBranding } from "@/lib/actions";
import HeaderActions from "@/components/HeaderActions";
import RoleSelector from "@/components/RoleSelector";
import UserManager from "@/components/UserManager";
import LogoUpload from "@/components/LogoUpload";
import { db } from "@/lib/db";
import { parkingSpots, staffMembers, parkingRecords, accesses } from "@/lib/schema";
import { isNull, desc, sql, eq } from "drizzle-orm";
import Image from "next/image";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: branding.systemName || "Gestión de Estacionamientos",
    description: branding.description || "Sistema de Control de Acceso",
  };
}

export default async function Home() {
  const spots = await db.select().from(parkingSpots).all();
  const staff = await db.select().from(staffMembers).all();
  const activeRecords = await db.select().from(parkingRecords).where(isNull(parkingRecords.exitTime)).all();
  const gates = await db.select().from(accesses).all();

  // Fetch recent activity
  const recentActivity = await db.select({
    id: parkingRecords.id,
    licensePlate: parkingRecords.licensePlate,
    entryTime: parkingRecords.entryTime,
    exitTime: parkingRecords.exitTime,
    spotId: parkingRecords.spotId,
    entryType: parkingRecords.entryType,
    cost: parkingRecords.cost,
    spotCode: parkingSpots.code,
  })
    .from(parkingRecords)
    .leftJoin(parkingSpots, eq(parkingRecords.spotId, parkingSpots.id))
    .orderBy(sql`coalesce(${parkingRecords.exitTime}, ${parkingRecords.entryTime}) desc`)
    .limit(10)
    .all();

  const enrichedSpots = spots.map((spot: any) => {
    const assignedStaff = staff.find((s: any) => s.assignedSpotId === spot.id);
    const activeRecord = activeRecords.find((r: any) => r.spotId === spot.id);

    return {
      ...spot,
      ownerPlate: assignedStaff ? assignedStaff.licensePlate : undefined,
      ownerName: assignedStaff ? assignedStaff.name : undefined,
      ownerPhone: assignedStaff ? (assignedStaff.phoneNumber || undefined) : undefined,
      vacationStart: assignedStaff && assignedStaff.vacationStart ? assignedStaff.vacationStart.toISOString() : undefined,
      vacationEnd: assignedStaff && assignedStaff.vacationEnd ? assignedStaff.vacationEnd.toISOString() : undefined,
      currentPlate: activeRecord ? activeRecord.licensePlate : undefined,
      entryTime: activeRecord ? activeRecord.entryTime.toISOString() : undefined,
      monthlyFee: spot.monthlyFee ?? undefined,
      accessId: spot.accessId ?? undefined
    };
  });

  // Calculate Statistics
  const totalSpots = spots.length;
  const occupiedSpots = spots.filter((s: any) => s.isOccupied).length;
  const availableSpots = totalSpots - occupiedSpots;
  const reservedSpotsTotal = spots.filter((s: any) => s.type === "RESERVED").length;

  const today = new Date();
  const staffOnVacation = staff.filter((s: any) =>
    s.vacationStart && s.vacationEnd &&
    s.vacationStart <= today && s.vacationEnd >= today
  ).length;

  const currentPrice = await getPricePerMinute();
  const chargingEnabled = await isChargingEnabled();
  const branding = await getBranding();

  // Financial Stats Today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const entriesToday = await db.select()
    .from(parkingRecords)
    .where(sql`${parkingRecords.entryTime} >= ${todayStart.getTime() / 1000}`)
    .all();

  const revenueToday = entriesToday.reduce((sum: any, r: any) => sum + (r.cost || 0), 0);

  // Projected revenue (cars currently inside - Manual only)
  const pendingRevenue = activeRecords
    .filter((r: any) => r.entryType === "MANUAL")
    .reduce((sum: any, r: any) => {
      const durationMins = (new Date().getTime() - r.entryTime.getTime()) / (1000 * 60);
      const rawCost = durationMins * currentPrice;
      const rounded = Math.round(rawCost / 10) * 10;
      return sum + rounded;
    }, 0);

  const todayStats = {
    revenue: revenueToday,
    pending: pendingRevenue,
    count: entriesToday.length
  };

  const safeLogoUrl = (branding.logoUrl && branding.logoUrl.trim() !== "")
    ? (branding.logoUrl.startsWith("http") || branding.logoUrl.startsWith("/") || branding.logoUrl.startsWith("data:image") ? branding.logoUrl : `/${branding.logoUrl}`)
    : "/at-sit-logo.png";

  return (
    <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "40px 20px" }}>
      <div className="animate-fade-in">

        {/* Header Section */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
          background: "white",
          padding: "24px",
          borderRadius: "var(--border-radius)",
          boxShadow: "var(--shadow)",
          flexWrap: "wrap",
          gap: "24px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "25px", flex: "1 1 700px" }}>
            <div style={{ flexShrink: 0, width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogoUpload initialUrl={safeLogoUrl} companyName={branding.companyName} />
            </div>
            <div style={{ flexGrow: 1, minWidth: "400px" }}>
              <h1 style={{ color: "var(--primary)", margin: 0, fontSize: "28px", fontWeight: "900", letterSpacing: "-0.5px" }}>
                {branding.systemName}
              </h1>
              <p style={{ color: "#64748b", margin: "4px 0 16px 0", fontSize: "16px", fontWeight: "500" }}>
                {branding.description}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap", marginTop: "10px" }}>
                <HeaderActions
                  chargingEnabled={chargingEnabled}
                  currentPrice={currentPrice}
                  branding={branding}
                />
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right", color: "#64748b", flexShrink: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: "700", textTransform: "capitalize" }}>
              {today.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} de {today.getFullYear()}
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "var(--primary)", marginTop: "4px" }}>
              {today.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </header>

        {/* Stats Section */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "40px"
        }}>
          <StatCard title="Total Sitios" value={totalSpots} icon="🅿️" />
          <StatCard title="Disponibles" value={availableSpots} valueColor="var(--success)" icon="✅" />
          <StatCard title="Ocupados" value={occupiedSpots} valueColor="var(--error)" icon="🚗" extra={`${((occupiedSpots / totalSpots) * 100).toFixed(1)}%`} />
          <StatCard title="Reservados" value={reservedSpotsTotal} icon="👤" />
          <StatCard title="En Vacaciones" value={staffOnVacation} valueColor="var(--warning)" icon="🌴" />
        </div>

      </div>
      <ParkingGrid
        initialSpots={enrichedSpots}
        recentActivity={recentActivity}
        chargingEnabled={chargingEnabled}
        todayStats={todayStats}
        gates={gates}
      />

      <UserManager />
      <RoleSelector />
    </main>
  );
}

function StatCard({ title, value, valueColor, icon, extra }: { title: string, value: number, valueColor?: string, icon: string, extra?: string }) {
  return (
    <div style={{
      background: "white",
      padding: "14px 18px",
      borderRadius: "var(--border-radius)",
      boxShadow: "var(--shadow)",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      position: "relative"
    }}>
      {extra && (
        <div style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          fontSize: "11px",
          fontWeight: "800",
          color: "#94a3b8",
          background: "#f8fafc",
          padding: "1px 6px",
          borderRadius: "8px",
          border: "1px solid #f1f5f9"
        }}>
          {extra}
        </div>
      )}
      <div style={{ fontSize: "24px", background: "#f8fafc", padding: "8px", borderRadius: "10px" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "700", marginBottom: "2px" }}>{title}</div>
        <div style={{ fontSize: "22px", fontWeight: "950", color: valueColor || "var(--foreground)", lineHeight: "1" }}>{value}</div>
      </div>
    </div>
  );
}

