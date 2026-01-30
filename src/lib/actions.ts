"use server";

import { db } from "./db";
import { parkingSpots, staffMembers, parkingRecords, settings, users, accesses, cameras } from "./schema";
import { eq, and, or, isNull, lte, gte, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type AccessResult = {
  allowed: boolean;
  message: string;
  spot?: typeof parkingSpots.$inferSelect;
  staff?: typeof staffMembers.$inferSelect;
  entryType: "AUTOMATIC" | "MANUAL";
};

function safeRevalidate() {
  try {
    revalidatePath("/");
  } catch (e) {
    console.error("Revalidate failed:", e);
  }
}

// Chilean Rounding Logic: Round to nearest 10 if cash-like, or just integer.
// "Redondeo Chileno" at cashiers: 1-5 down to 0, 6-9 up to 10.
function applyChileanRounding(amount: number): number {
  return Math.round(amount / 10) * 10;
}

export async function getPricePerMinute(): Promise<number> {
  try {
    const result = (await db.select().from(settings).where(eq(settings.key, "price_per_minute")))[0];
    return result ? parseInt(result.value) : 25; // Default 25 CLP/min
  } catch (e) {
    console.error("Error fetching price_per_minute:", e);
    return 25;
  }
}

export async function setPricePerMinute(price: number) {
  const existing = (await db.select().from(settings).where(eq(settings.key, "price_per_minute")))[0];
  if (existing) {
    await db.update(settings).set({ value: price.toString() }).where(eq(settings.key, "price_per_minute"));
  } else {
    await db.insert(settings).values({ key: "price_per_minute", value: price.toString() });
  }
  safeRevalidate();
}

export async function isChargingEnabled(): Promise<boolean> {
  try {
    const result = (await db.select().from(settings).where(eq(settings.key, "charging_enabled")))[0];
    return result ? result.value === "true" : true; // Default true
  } catch (e) {
    console.error("Error fetching charging_enabled:", e);
    return true;
  }
}

export async function setChargingEnabled(enabled: boolean) {
  const existing = (await db.select().from(settings).where(eq(settings.key, "charging_enabled")))[0];
  if (existing) {
    await db.update(settings).set({ value: enabled.toString() }).where(eq(settings.key, "charging_enabled"));
  } else {
    await db.insert(settings).values({ key: "charging_enabled", value: enabled.toString() });
  }
  safeRevalidate();
}

export async function getBranding() {
  const branding = {
    companyName: "Mi Estacionamiento",
    systemName: "Panel de Control de Estacionamientos",
    description: "Sistema de Gestión de Acceso Vehicular",
    logoUrl: "/at-sit-logo.png"
  };

  try {
    const allSettings = await db.select().from(settings);
    allSettings.forEach((s: any) => {
      if (s.key === "company_name" && s.value) branding.companyName = s.value;
      if (s.key === "system_name" && s.value) branding.systemName = s.value;
      if (s.key === "description" && s.value) branding.description = s.value;
      if (s.key === "logo_url" && s.value) {
        if (s.value.startsWith("/") || s.value.startsWith("http") || s.value.startsWith("data:image")) {
          branding.logoUrl = s.value;
        }
      }
    });
  } catch (e) {
    console.error("Error fetching branding settings:", e);
  }

  return branding;
}

export async function updateBranding(data: { companyName?: string, systemName?: string, description?: string, logoUrl?: string }) {
  const entries = [
    { key: "company_name", value: data.companyName },
    { key: "system_name", value: data.systemName },
    { key: "description", value: data.description },
    { key: "logo_url", value: data.logoUrl }
  ].filter(e => e.value !== undefined);

  for (const entry of entries) {
    if (entry.value === undefined) continue;
    const existing = (await db.select().from(settings).where(eq(settings.key, entry.key)))[0];
    if (existing) {
      await db.update(settings).set({ value: entry.value }).where(eq(settings.key, entry.key));
    } else {
      await db.insert(settings).values({ key: entry.key, value: entry.value });
    }
  }
  safeRevalidate();
}

export async function processVehicleEntry(licensePlate: string, accessId: string): Promise<AccessResult> {
  const today = new Date();

  const staffResults = await db.select().from(staffMembers).where(eq(staffMembers.licensePlate, licensePlate));
  const staff = staffResults[0];

  if (staff) {
    const onVacation = staff.vacationStart && staff.vacationEnd &&
      staff.vacationStart <= today && staff.vacationEnd >= today;

    if (!onVacation && staff.assignedSpotId) {
      // Check spot status
      const spotResults = await db.select().from(parkingSpots).where(eq(parkingSpots.id, staff.assignedSpotId));
      const spot = spotResults[0];

      if (spot && !spot.isOccupied) {
        await occupySpot(spot.id, licensePlate, "AUTOMATIC", accessId);
        return {
          allowed: true,
          message: `Bienvenido ${staff.name} (Abonado). Acceso Automático a Sitio ${spot.code}`,
          spot,
          staff,
          entryType: "AUTOMATIC"
        };
      } else {
        return {
          allowed: false,
          message: `Hola ${staff.name}. Tu sitio reservado parece estar ocupado (o ya ingresaste). Por favor contacta al guardia.`,
          staff,
          entryType: "MANUAL"
        };
      }
    } else if (onVacation) {
      return {
        allowed: false,
        message: `Abonado ${staff.name} está de vacaciones. Asignar como Visita.`,
        staff,
        entryType: "MANUAL"
      };
    }
  }

  return {
    allowed: false,
    message: "Vehículo Desconocido o Visita. Requiere Asignación Manual.",
    entryType: "MANUAL"
  };
}



export async function occupySpot(spotId: number, licensePlate: string, type: "AUTOMATIC" | "MANUAL", accessId?: string) {
  console.log(`[Action] Attempting occupySpot: Spot ${spotId}, Plate ${licensePlate}, Type ${type}`);
  try {
    // Detective Debugging Check: Ensure spot isn't ALREADY occupied before doing anything
    const spot = (await db.select().from(parkingSpots).where(eq(parkingSpots.id, spotId)))[0];

    if (!spot) {
      throw new Error(`Sitio ${spotId} no existe.`);
    }

    if (spot.isOccupied) {
      console.warn(`[Action] Spot ${spotId} is already occupied. Aborting occupation for plate ${licensePlate}.`);
      return { success: false, message: "El sitio ya está ocupado." };
    }

    await db.transaction(async (tx: any) => {
      await tx.update(parkingSpots)
        .set({ isOccupied: true })
        .where(eq(parkingSpots.id, spotId));

      await tx.insert(parkingRecords).values({
        licensePlate,
        spotId,
        entryType: type,
        entryAccessId: accessId,
        entryTime: new Date()
      });
    });
    console.log(`[Action] Successfully occupied spot ${spotId} with plate ${licensePlate}`);

    // IMPORTANT: Call revalidate inside the function before returning
    safeRevalidate();

    return { success: true };
  } catch (error) {
    console.error(`[Action] Error in occupySpot:`, error);
    throw error;
  }
}

export async function freeSpot(spotId: number) {
  const exitTime = new Date();
  const pricePerMinute = await getPricePerMinute();
  const chargingEnabled = await isChargingEnabled();
  let result = {
    success: false,
    cost: 0,
    durationInSeconds: 0,
    entryTime: null as Date | null,
    exitTime: null as Date | null
  };

  await db.transaction(async (tx: any) => {
    // Find the active record to calculate cost
    const record = (await tx.select().from(parkingRecords)
      .where(and(eq(parkingRecords.spotId, spotId), isNull(parkingRecords.exitTime))))[0];

    let cost = 0;
    let durationInSeconds = 0;
    let entryTimeObj: Date | null = null;

    if (record) {
      entryTimeObj = new Date(record.entryTime);
      durationInSeconds = Math.max(0, (exitTime.getTime() - entryTimeObj.getTime()) / 1000);

      // If it's a manual entry (Visitor) and charging is enabled, we charge.
      if (record.entryType === "MANUAL" && chargingEnabled) {
        const rawCost = (durationInSeconds / 60) * pricePerMinute;
        cost = applyChileanRounding(rawCost);
      }
      result = {
        success: true,
        cost,
        durationInSeconds,
        entryTime: entryTimeObj,
        exitTime: exitTime
      };
    }

    await tx.update(parkingSpots)
      .set({ isOccupied: false })
      .where(eq(parkingSpots.id, spotId));

    await tx.update(parkingRecords)
      .set({
        exitTime,
        cost: cost > 0 ? cost : null
      })
      .where(and(eq(parkingRecords.spotId, spotId), isNull(parkingRecords.exitTime)));
  });

  safeRevalidate();
  return result;
}

export async function updateSpotAssignment(spotId: number, data: { name: string; plate: string; phone: string; vacationStart?: Date | null; vacationEnd?: Date | null }) {
  const currentStaffResult = await db.select().from(staffMembers).where(eq(staffMembers.assignedSpotId, spotId));
  const currentStaff = currentStaffResult[0];

  await db.transaction(async (tx: any) => {
    if (currentStaff) {
      await tx.update(staffMembers)
        .set({
          name: data.name,
          licensePlate: data.plate,
          phoneNumber: data.phone,
          vacationStart: data.vacationStart,
          vacationEnd: data.vacationEnd
        })
        .where(eq(staffMembers.id, currentStaff.id));
    } else {
      await tx.insert(staffMembers).values({
        name: data.name,
        licensePlate: data.plate,
        phoneNumber: data.phone,
        role: "Abonado",
        assignedSpotId: spotId,
        vacationStart: data.vacationStart,
        vacationEnd: data.vacationEnd
      });
    }
  });
  safeRevalidate();
}

export async function removeSpotAssignment(spotId: number) {
  await db.transaction(async (tx: any) => {
    await tx.update(staffMembers)
      .set({ assignedSpotId: null })
      .where(eq(staffMembers.assignedSpotId, spotId));
  });
  safeRevalidate();
}



export async function processVehicleExit(licensePlate: string, accessId: string) {
  const activeRecordResults = await db.select().from(parkingRecords)
    .where(and(eq(parkingRecords.licensePlate, licensePlate), isNull(parkingRecords.exitTime)));
  const record = activeRecordResults[0];

  if (record && record.spotId) {
    const exitTime = new Date();
    const entryTime = new Date(record.entryTime);
    const durationSeconds = Math.round((exitTime.getTime() - entryTime.getTime()) / 1000);

    // We must call freeSpot which now calculates cost
    await db.update(parkingRecords)
      .set({ exitAccessId: accessId })
      .where(eq(parkingRecords.id, record.id));

    await freeSpot(record.spotId);

    const updatedRecord = (await db.select().from(parkingRecords).where(eq(parkingRecords.id, record.id)))[0];
    const spotResults = await db.select().from(parkingSpots).where(eq(parkingSpots.id, record.spotId));
    const spot = spotResults[0];

    return {
      success: true,
      message: `Salida Registrada: Patente ${licensePlate} liberó sitio ${spot.code}.`,
      cost: updatedRecord?.cost || 0,
      durationSeconds
    };
  } else {
    return {
      success: false,
      message: `Vehículo ${licensePlate} no encontrado en el estacionamiento.`
    };
  }
}

// Stats & Simulation Actions

export async function clearAllRecords() {
  await db.transaction(async (tx: any) => {
    await tx.delete(parkingRecords);
    await tx.delete(staffMembers);
    await tx.update(parkingSpots).set({
      isOccupied: false,
      type: "GENERAL",
      monthlyFee: 0,
      reservedForId: null
    });
  });
  safeRevalidate();
}

export async function simulateOneMonthData() {
  console.log("Starting simulation of 1 month data...");
  const pricePerMinute = await getPricePerMinute();
  const spots = await db.select().from(parkingSpots);
  const staff = await db.select().from(staffMembers);

  const now = new Date();
  const records: (typeof parkingRecords.$inferInsert)[] = [];

  // Simulate 30 days
  for (let i = 29; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);

    // Random number of entries per day (between 10 and 50)
    const entriesToday = Math.floor(Math.random() * 40) + 10;

    for (let j = 0; j < entriesToday; j++) {
      // Random hour between 07:00 and 20:00 (more realistic)
      let hour = 7 + Math.floor(Math.random() * 13);

      // If we are simulating "today" (i === 0), limit the hour to the current hour
      if (i === 0) {
        const currentHour = now.getHours();
        if (currentHour > 7) {
          hour = 7 + Math.floor(Math.random() * (currentHour - 7));
        } else {
          hour = Math.max(0, currentHour - 1);
        }
      }

      const minute = Math.floor(Math.random() * 60);
      const entryTime = new Date(day);
      entryTime.setHours(hour, minute, 0);

      // Random duration between 20 mins and 4 hours
      const durationMins = 20 + Math.floor(Math.random() * 220);
      const exitTime = new Date(entryTime.getTime() + durationMins * 60 * 1000);

      // Ensure exitTime is also not in the future for today
      if (i === 0 && exitTime > now) {
        // Skip records that would end in the future, or cap them? 
        // Let's just make their entry earlier.
        continue;
      }

      const isStaff = Math.random() > 0.6; // 40% chance of being staff
      let licensePlate = "";
      let entryType: "AUTOMATIC" | "MANUAL" = "MANUAL";
      let spotId = spots[Math.floor(Math.random() * spots.length)].id;
      let cost = null;

      if (isStaff && staff.length > 0) {
        const randomStaff = staff[Math.floor(Math.random() * staff.length)];
        licensePlate = randomStaff.licensePlate;
        if (randomStaff.assignedSpotId) spotId = randomStaff.assignedSpotId;
        entryType = "AUTOMATIC";
      } else {
        const letters = "ABCDEFGH".split("");
        licensePlate = `${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}-${Math.floor(100 + Math.random() * 900)}`;
        entryType = "MANUAL";
        cost = applyChileanRounding((durationMins) * pricePerMinute);
      }

      records.push({
        id: crypto.randomUUID(),
        licensePlate,
        entryTime,
        exitTime,
        spotId,
        entryType,
        cost
      });
    }
  }

  // Insert historical records in batches
  await db.transaction(async (tx: any) => {
    for (const record of records) {
      await tx.insert(parkingRecords).values(record);
    }
  });

  // NEW: Simulate "Current State" for testing
  // Occupy about 20-30% of spots with active records (no exit time)
  const currentRecords: (typeof parkingRecords.$inferInsert)[] = [];
  const spotsToOccupy = spots.filter(() => Math.random() > 0.7); // 30% occupancy

  await db.transaction(async (tx: any) => {
    for (const spot of spotsToOccupy) {
      const isStaff = Math.random() > 0.4 && staff.some((s: any) => s.assignedSpotId === spot.id);
      let licensePlate = "";
      let entryType: "AUTOMATIC" | "MANUAL" = "MANUAL";

      const entryTime = new Date();
      entryTime.setHours(entryTime.getHours() - Math.floor(Math.random() * 5)); // Entered 0-5 hours ago

      if (isStaff) {
        const staffMember: any = staff.find((s: any) => s.assignedSpotId === spot.id);
        licensePlate = staffMember?.licensePlate || "STF-999";
        entryType = "AUTOMATIC";
      } else {
        const letters = "JKLMNPQR".split("");
        licensePlate = `${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}-${Math.floor(100 + Math.random() * 900)}`;
        entryType = "MANUAL";
      }

      await tx.insert(parkingRecords).values({
        id: crypto.randomUUID(),
        licensePlate,
        entryTime,
        exitTime: null,
        spotId: spot.id,
        entryType,
        cost: null
      });

      await tx.update(parkingSpots)
        .set({ isOccupied: true })
        .where(eq(parkingSpots.id, spot.id));

      currentRecords.push({ id: "dummy", licensePlate, entryTime, exitTime: null, spotId: spot.id, entryType, cost: null });
    }
  });

  safeRevalidate();
  return { success: true, count: records.length + currentRecords.length };
}

export async function getReportData(startDateStr: string | Date, endDateStr: string | Date) {
  // Ensure we handle both string and Date inputs safely
  const parseDate = (d: string | Date) => {
    if (d instanceof Date) return d;
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  };

  const start = parseDate(startDateStr);
  start.setHours(0, 0, 0, 0);
  const end = parseDate(endDateStr);
  end.setHours(23, 59, 59, 999);

  const records = await db.select().from(parkingRecords)
    .where(and(
      sql`${parkingRecords.entryTime} <= ${end}`,
      sql`${parkingRecords.entryTime} >= ${start}`
    ));

  console.log(`[Report] Range: ${start.toLocaleString()} to ${end.toLocaleString()} | Records found: ${records.length}`);

  const timeRevenue = records.reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

  // Calculate Subscription Revenue (Abonados) - ONLY count spots with an active assignment
  const subscribedSpots = await db.select({
    monthlyFee: parkingSpots.monthlyFee
  })
    .from(parkingSpots)
    .innerJoin(staffMembers, eq(staffMembers.assignedSpotId, parkingSpots.id));

  const monthlySubscriptionTotal = subscribedSpots.reduce((sum: number, s: any) => sum + (s.monthlyFee || 0), 0);

  // Precise calculation: (Days in range / 30) * monthly fee
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // If the range looks like a full month (28-31 days), treat as 1.0 month
  let monthsInRange = diffDays / 30;
  if (diffDays >= 28 && diffDays <= 32) monthsInRange = 1.0;

  const subscriptionRevenue = Math.round(monthlySubscriptionTotal * monthsInRange);

  const totalRevenue = timeRevenue + subscriptionRevenue;
  const totalEntries = records.length;
  const manualEntries = records.filter((r: any) => r.entryType === "MANUAL").length;
  const subscriberEntries = records.filter((r: any) => r.entryType === "AUTOMATIC").length;

  const allSpots = await db.select().from(parkingSpots);

  // Detailed lists for "Control Cruzado"
  const visitsList = records.filter((r: any) => r.entryType === "MANUAL").map((r: any) => ({
    licensePlate: r.licensePlate,
    entryTime: r.entryTime,
    exitTime: r.exitTime,
    cost: r.cost,
    spotCode: r.spotId ? allSpots.find((s: any) => s.id === r.spotId)?.code : "N/A"
  }));

  const subscribersList = await db.select({
    name: staffMembers.name,
    plate: staffMembers.licensePlate,
    spotCode: parkingSpots.code,
    monthlyFee: parkingSpots.monthlyFee
  })
    .from(parkingSpots)
    .leftJoin(staffMembers, eq(staffMembers.assignedSpotId, parkingSpots.id))
    .where(eq(parkingSpots.type, "RESERVED"))
    .orderBy(parkingSpots.code);

  // Revenue by day
  const revenueByDay: Record<string, number> = {};
  const entriesByDay: Record<string, number> = {};
  // Peak hours (0-23)
  const peakHours: Record<number, number> = {};
  for (let i = 0; i < 24; i++) peakHours[i] = 0;

  let totalDurationSeconds = 0;
  let exitCount = 0;

  records.forEach((r: any) => {
    // Group by local date YYYY-MM-DD
    const d = r.entryTime;
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    revenueByDay[day] = (revenueByDay[day] || 0) + (r.cost || 0);
    entriesByDay[day] = (entriesByDay[day] || 0) + 1;

    const hour = r.entryTime.getHours();
    peakHours[hour]++;

    if (r.exitTime) {
      totalDurationSeconds += (r.exitTime.getTime() - r.entryTime.getTime()) / 1000;
      exitCount++;
    }
  });

  const avgStaySeconds = exitCount > 0 ? totalDurationSeconds / exitCount : 0;

  // Convert to sorted arrays for charting
  const dailyRevenue = Object.entries(revenueByDay).map(([day, revenue]) => ({
    day,
    revenue,
    entries: entriesByDay[day] || 0
  })).sort((a, b) => a.day.localeCompare(b.day));
  const hourlyTraffic = Object.entries(peakHours).map(([hour, count]) => ({ hour: parseInt(hour), count }));

  return {
    summary: {
      totalRevenue,
      timeRevenue,
      subscriptionRevenue,
      totalEntries,
      manualEntries,
      subscriberEntries,
      avgStaySeconds,
      avgRevenuePerEntry: manualEntries > 0 ? timeRevenue / manualEntries : 0
    },
    dailyRevenue,
    hourlyTraffic,
    visitsList,
    subscribersList,
    chargingEnabled: await isChargingEnabled()
  };
}

export async function getAvailableGeneralSpots(accessId?: string) {
  let query = db.select()
    .from(parkingSpots)
    .where(and(
      eq(parkingSpots.type, "GENERAL"),
      eq(parkingSpots.isOccupied, false)
    ));

  if (accessId && accessId !== "ALL" && accessId !== "gate-a") { // Logic tweak: gate-a usually sees all or filtered? Assuming strict filter
    // However, if accessId is provided, we filter.
    query = db.select()
      .from(parkingSpots)
      .where(and(
        eq(parkingSpots.type, "GENERAL"),
        eq(parkingSpots.isOccupied, false),
        eq(parkingSpots.accessId, accessId)
      ));
  }

  // NEW: Enforce Sequential Assignment (Low -> High)
  // We sort by ID to ensure stability, or Code if alphanumeric logic is preferred. 
  // Using ID is usually safest for "filling up" if IDs are sequential.
  // If codes are "A1", "A2", etc., code sorting is better.
  // Let's us ID for now as it maps to insertion order usually.
  return await query.orderBy(asc(parkingSpots.id));
}

export async function getSpotCounts(towerId: string = "T1") {
  const allSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId));
  return {
    total: allSpots.length,
    general: allSpots.filter((s: any) => s.type === "GENERAL").length,
    reserved: allSpots.filter((s: any) => s.type === "RESERVED").length,
    towerId
  };
}

export async function updateSpotCounts(totalCount: number, towerId: string = "T1") {
  const allSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId));
  const currentCount = allSpots.length;

  // Mapa automático de Torre a Puerta
  const gateMapping: Record<string, string> = {
    "T1": "gate-1",
    "T2": "gate-2",
    "T3": "gate-3"
  };
  const targetGateId = gateMapping[towerId];

  await db.transaction(async (tx: any) => {
    if (totalCount > currentCount) {
      // Add new spots as General by default
      for (let i = currentCount + 1; i <= totalCount; i++) {
        await tx.insert(parkingSpots).values({
          code: `${towerId}-${i.toString().padStart(2, '0')}`,
          towerId,
          accessId: targetGateId, // Vincular a la puerta correspondiente
          type: "GENERAL",
          isOccupied: false
        });
      }
    } else if (totalCount < currentCount) {
      // Remove from the end, but only if not occupied
      const toRemove = allSpots.slice(totalCount).reverse();
      for (const spot of toRemove) {
        if (!spot.isOccupied) {
          // Unassign staff if any
          await tx.update(staffMembers).set({ assignedSpotId: null }).where(eq(staffMembers.assignedSpotId, spot.id));
          await tx.delete(parkingSpots).where(eq(parkingSpots.id, spot.id));
        }
      }
    }

    // FINAL STEP: Sequential Renumbering (The "Fixed Asset" logic)
    // Ensures codes are always T1-01, T1-02... Regardless of history
    // UPDATED: Also ensure accessId is correctly set for all spots in this tower
    const finalSpots = (await tx.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId))).sort((a: any, b: any) => a.id - b.id);
    for (const [idx, spot] of finalSpots.entries()) {
      await tx.update(parkingSpots)
        .set({
          code: `${towerId}-${(idx + 1).toString().padStart(2, '0')}`,
          accessId: targetGateId // Corregir vinculación si era nula
        })
        .where(eq(parkingSpots.id, spot.id));
    }
  });

  safeRevalidate();
}

export async function toggleSpotType(spotId: number) {
  const spot = (await db.select().from(parkingSpots).where(eq(parkingSpots.id, spotId)))[0];
  if (!spot) return;

  const nextType = spot.type === "GENERAL" ? "RESERVED" : "GENERAL";

  await db.transaction(async (tx: any) => {
    await tx.update(parkingSpots)
      .set({ type: nextType })
      .where(eq(parkingSpots.id, spotId));

    if (nextType === "GENERAL") {
      await tx.update(staffMembers)
        .set({ assignedSpotId: null })
        .where(eq(staffMembers.assignedSpotId, spotId));
    }
  });

  safeRevalidate();
}

export async function updateSpotMonthlyFee(spotId: number, fee: number) {
  await db.update(parkingSpots)
    .set({ monthlyFee: fee })
    .where(eq(parkingSpots.id, spotId));
  safeRevalidate();
}

export async function getTrialStatus() {
  const existing = (await db.select().from(settings).where(eq(settings.key, "install_date")))[0];
  const now = Math.floor(Date.now() / 1000);

  if (!existing) {
    // First run, set the install date
    await db.insert(settings).values({ key: "install_date", value: now.toString() });
    return { expired: false, daysLeft: 15 };
  }

  const installDate = parseInt(existing.value);
  const diffDays = Math.floor((now - installDate) / (24 * 3600));
  const daysLeft = Math.max(0, 15 - diffDays);

  return {
    expired: diffDays >= 15,
    daysLeft
  };
}

export async function isOperatorOnly() {
  return process.env.APP_MODE === "OPERATOR";
}

// USER MANAGEMENT ACTIONS

export async function loginUser(username: string, password: string) {
  console.log(`[Login] Intentando entrar con usuario: ${username}`);
  try {
    // Sanity check: ¿Responde la DB?
    await db.execute(sql`SELECT 1`);

    const result = (await db.select({
      user: users,
      access: accesses
    })
      .from(users)
      .leftJoin(accesses, eq(users.accessId, accesses.id))
      .where(eq(users.username, username)))[0];

    if (!result) {
      console.warn(`[Login] Usuario no encontrado: ${username}`);
      return { success: false, message: "Usuario no encontrado. ¿Ejecutaste /api/setup?" };
    }

    console.log(`[Login] Usuario encontrado. Validando contraseña...`);

    if (result.user.password === password) {
      const { password: _, ...userWithoutPassword } = result.user;
      console.log(`[Login] Éxito para: ${username} (Rol: ${result.user.role})`);
      return {
        success: true,
        user: {
          ...userWithoutPassword,
          accessName: result.access?.name
        }
      };
    }

    console.warn(`[Login] Contraseña incorrecta para: ${username}`);
    return { success: false, message: "Contraseña incorrecta." };
  } catch (error) {
    console.error(`[Login Error]:`, error);
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return {
      success: false,
      message: `Error de Servidor: ${errorMsg}. Asegúrate de haber entrado a /api/setup y de tener una DB activa.`
    };
  }
}

export async function getUsers() {
  return await db.select({
    user: users,
    access: accesses
  })
    .from(users)
    .leftJoin(accesses, eq(users.accessId, accesses.id));
}

export async function getAccesses() {
  return await db.select().from(accesses);
}

export async function getCameras() {
  return await db.select({
    camera: cameras,
    access: accesses
  })
    .from(cameras)
    .leftJoin(accesses, eq(cameras.accessId, accesses.id));
}

export async function createUser(data: typeof users.$inferInsert) {
  try {
    await db.insert(users).values(data);
    safeRevalidate();
    return { success: true };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: "Error al crear el usuario. Probablemente el nombre o email ya existen." };
  }
}

export async function deleteUser(userId: string) {
  try {
    await db.delete(users).where(eq(users.id, userId));
    safeRevalidate();
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: "Error al eliminar el usuario." };
  }
}
