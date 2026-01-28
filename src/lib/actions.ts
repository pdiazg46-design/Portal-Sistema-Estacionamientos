
"use server";

import { db } from "./db";
import { parkingSpots, staffMembers, parkingRecords, settings, users, accesses, cameras } from "./schema";
import { eq, and, or, isNull, lte, gte, sql } from "drizzle-orm";
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
  const result = await db.select().from(settings).where(eq(settings.key, "price_per_minute")).get();
  return result ? parseInt(result.value) : 25; // Default 25 CLP/min
}

export async function setPricePerMinute(price: number) {
  const existing = await db.select().from(settings).where(eq(settings.key, "price_per_minute")).get();
  if (existing) {
    await db.update(settings).set({ value: price.toString() }).where(eq(settings.key, "price_per_minute")).run();
  } else {
    await db.insert(settings).values({ key: "price_per_minute", value: price.toString() }).run();
  }
  safeRevalidate();
}

export async function isChargingEnabled(): Promise<boolean> {
  const result = await db.select().from(settings).where(eq(settings.key, "charging_enabled")).get();
  return result ? result.value === "true" : true; // Default true
}

export async function setChargingEnabled(enabled: boolean) {
  const existing = await db.select().from(settings).where(eq(settings.key, "charging_enabled")).get();
  if (existing) {
    await db.update(settings).set({ value: enabled.toString() }).where(eq(settings.key, "charging_enabled")).run();
  } else {
    await db.insert(settings).values({ key: "charging_enabled", value: enabled.toString() }).run();
  }
  safeRevalidate();
}

export async function getBranding() {
  const allSettings = await db.select().from(settings).all();
  const branding = {
    companyName: "Mi Estacionamiento",
    systemName: "Panel de Control de Estacionamientos",
    description: "Sistema de Gestión de Acceso Vehicular",
    logoUrl: "/at-sit-logo.png"
  };

  allSettings.forEach(s => {
    if (s.key === "company_name" && s.value) branding.companyName = s.value;
    if (s.key === "system_name" && s.value) branding.systemName = s.value;
    if (s.key === "description" && s.value) branding.description = s.value;
    if (s.key === "logo_url" && s.value) {
      // Only accept relative paths, http URLs, or data URIs (base64)
      if (s.value.startsWith("/") || s.value.startsWith("http") || s.value.startsWith("data:image")) {
        branding.logoUrl = s.value;
      }
    }
  });

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
    const existing = await db.select().from(settings).where(eq(settings.key, entry.key)).get();
    if (existing) {
      await db.update(settings).set({ value: entry.value }).where(eq(settings.key, entry.key)).run();
    } else {
      await db.insert(settings).values({ key: entry.key, value: entry.value }).run();
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

export async function getAvailableGeneralSpots(accessId?: string) {
  const today = new Date();

  // Condición base: No ocupado
  const conditions = [eq(parkingSpots.isOccupied, false)];

  // Si se especifica acceso, filtrar por él
  if (accessId) {
    conditions.push(eq(parkingSpots.accessId, accessId));
  }

  const allEmptySpots = await db.select().from(parkingSpots).where(and(...conditions));
  const availableSpots = [];

  for (const spot of allEmptySpots) {
    if (spot.type === "GENERAL") {
      availableSpots.push(spot);
    } else if (spot.type === "RESERVED" && spot.id) {
      // Si el sitio es reservado, solo está disponible para visitas si el dueño está de vacaciones
      const ownerResults = await db.select().from(staffMembers).where(eq(staffMembers.assignedSpotId, spot.id));
      const owner = ownerResults[0];

      if (owner && owner.vacationStart && owner.vacationEnd &&
        owner.vacationStart <= today && owner.vacationEnd >= today) {
        availableSpots.push(spot);
      }
    }
  }
  return availableSpots;
}

export async function occupySpot(spotId: number, licensePlate: string, type: "AUTOMATIC" | "MANUAL", accessId?: string) {
  console.log(`[Action] Attempting occupySpot: Spot ${spotId}, Plate ${licensePlate}, Type ${type}`);
  try {
    // Detective Debugging Check: Ensure spot isn't ALREADY occupied before doing anything
    const spot = await db.select().from(parkingSpots).where(eq(parkingSpots.id, spotId)).get();

    if (!spot) {
      throw new Error(`Sitio ${spotId} no existe.`);
    }

    if (spot.isOccupied) {
      console.warn(`[Action] Spot ${spotId} is already occupied. Aborting occupation for plate ${licensePlate}.`);
      return { success: false, message: "El sitio ya está ocupado." };
    }

    db.transaction((tx) => {
      tx.update(parkingSpots)
        .set({ isOccupied: true })
        .where(eq(parkingSpots.id, spotId))
        .run();

      tx.insert(parkingRecords).values({
        licensePlate,
        spotId,
        entryType: type,
        entryAccessId: accessId,
        entryTime: new Date()
      }).run();
    });
    console.log(`[Action] Successfully occupied spot ${spotId} with plate ${licensePlate}`);
    return { success: true };
  } catch (error) {
    console.error(`[Action] Error in occupySpot:`, error);
    throw error;
  }

  safeRevalidate();
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

  db.transaction((tx) => {
    // Find the active record to calculate cost
    const record = tx.select().from(parkingRecords)
      .where(and(eq(parkingRecords.spotId, spotId), isNull(parkingRecords.exitTime)))
      .get();

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

    tx.update(parkingSpots)
      .set({ isOccupied: false })
      .where(eq(parkingSpots.id, spotId))
      .run();

    tx.update(parkingRecords)
      .set({
        exitTime,
        cost: cost > 0 ? cost : null
      })
      .where(and(eq(parkingRecords.spotId, spotId), isNull(parkingRecords.exitTime)))
      .run();
  });

  safeRevalidate();
  return result;
}

export async function updateSpotAssignment(spotId: number, data: { name: string; plate: string; phone: string; vacationStart?: Date | null; vacationEnd?: Date | null }) {
  const currentStaffResult = await db.select().from(staffMembers).where(eq(staffMembers.assignedSpotId, spotId));
  const currentStaff = currentStaffResult[0];

  db.transaction((tx) => {
    if (currentStaff) {
      tx.update(staffMembers)
        .set({
          name: data.name,
          licensePlate: data.plate,
          phoneNumber: data.phone,
          vacationStart: data.vacationStart,
          vacationEnd: data.vacationEnd
        })
        .where(eq(staffMembers.id, currentStaff.id))
        .run();
    } else {
      tx.insert(staffMembers).values({
        name: data.name,
        licensePlate: data.plate,
        phoneNumber: data.phone,
        role: "Abonado",
        assignedSpotId: spotId,
        vacationStart: data.vacationStart,
        vacationEnd: data.vacationEnd
      }).run();
    }
  });
  safeRevalidate();
}

export async function removeSpotAssignment(spotId: number) {
  db.transaction((tx) => {
    tx.update(staffMembers)
      .set({ assignedSpotId: null })
      .where(eq(staffMembers.assignedSpotId, spotId))
      .run();
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
      .where(eq(parkingRecords.id, record.id))
      .run();

    await freeSpot(record.spotId);

    const updatedRecord = await db.select().from(parkingRecords).where(eq(parkingRecords.id, record.id)).get();
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
  db.transaction((tx) => {
    tx.delete(parkingRecords).run();
    tx.delete(staffMembers).run();
    tx.update(parkingSpots).set({
      isOccupied: false,
      type: "GENERAL",
      monthlyFee: 0,
      reservedForId: null
    }).run();
  });
  safeRevalidate();
}

export async function simulateOneMonthData() {
  console.log("Starting simulation of 1 month data...");
  const pricePerMinute = await getPricePerMinute();
  const spots = await db.select().from(parkingSpots).all();
  const staff = await db.select().from(staffMembers).all();

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
  db.transaction((tx) => {
    for (const record of records) {
      tx.insert(parkingRecords).values(record).run();
    }
  });

  // NEW: Simulate "Current State" for testing
  // Occupy about 20-30% of spots with active records (no exit time)
  const currentRecords: (typeof parkingRecords.$inferInsert)[] = [];
  const spotsToOccupy = spots.filter(() => Math.random() > 0.7); // 30% occupancy

  db.transaction((tx) => {
    for (const spot of spotsToOccupy) {
      const isStaff = Math.random() > 0.4 && staff.some(s => s.assignedSpotId === spot.id);
      let licensePlate = "";
      let entryType: "AUTOMATIC" | "MANUAL" = "MANUAL";

      const entryTime = new Date();
      entryTime.setHours(entryTime.getHours() - Math.floor(Math.random() * 5)); // Entered 0-5 hours ago

      if (isStaff) {
        const staffMember = staff.find(s => s.assignedSpotId === spot.id);
        licensePlate = staffMember?.licensePlate || "STF-999";
        entryType = "AUTOMATIC";
      } else {
        const letters = "JKLMNPQR".split("");
        licensePlate = `${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}${letters[Math.floor(Math.random() * 8)]}-${Math.floor(100 + Math.random() * 900)}`;
        entryType = "MANUAL";
      }

      tx.insert(parkingRecords).values({
        id: crypto.randomUUID(),
        licensePlate,
        entryTime,
        exitTime: null,
        spotId: spot.id,
        entryType,
        cost: null
      }).run();

      tx.update(parkingSpots)
        .set({ isOccupied: true })
        .where(eq(parkingSpots.id, spot.id))
        .run();

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
      sql`${parkingRecords.entryTime} <= ${end.getTime() / 1000}`,
      sql`${parkingRecords.entryTime} >= ${start.getTime() / 1000}`
    ))
    .all();

  console.log(`[Report] Range: ${start.toLocaleString()} to ${end.toLocaleString()} | Records found: ${records.length}`);

  const timeRevenue = records.reduce((sum, r) => sum + (r.cost || 0), 0);

  // Calculate Subscription Revenue (Abonados) - ONLY count spots with an active assignment
  const subscribedSpots = await db.select({
    monthlyFee: parkingSpots.monthlyFee
  })
    .from(parkingSpots)
    .innerJoin(staffMembers, eq(staffMembers.assignedSpotId, parkingSpots.id))
    .all();

  const monthlySubscriptionTotal = subscribedSpots.reduce((sum, s) => sum + (s.monthlyFee || 0), 0);

  // Precise calculation: (Days in range / 30) * monthly fee
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // If the range looks like a full month (28-31 days), treat as 1.0 month
  let monthsInRange = diffDays / 30;
  if (diffDays >= 28 && diffDays <= 32) monthsInRange = 1.0;

  const subscriptionRevenue = Math.round(monthlySubscriptionTotal * monthsInRange);

  const totalRevenue = timeRevenue + subscriptionRevenue;
  const totalEntries = records.length;
  const manualEntries = records.filter(r => r.entryType === "MANUAL").length;
  const subscriberEntries = records.filter(r => r.entryType === "AUTOMATIC").length;

  const allSpots = await db.select().from(parkingSpots).all();

  // Detailed lists for "Control Cruzado"
  const visitsList = records.filter(r => r.entryType === "MANUAL").map(r => ({
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
    .orderBy(parkingSpots.code)
    .all();

  // Revenue by day
  const revenueByDay: Record<string, number> = {};
  const entriesByDay: Record<string, number> = {};
  // Peak hours (0-23)
  const peakHours: Record<number, number> = {};
  for (let i = 0; i < 24; i++) peakHours[i] = 0;

  let totalDurationSeconds = 0;
  let exitCount = 0;

  records.forEach(r => {
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

export async function getSpotCounts(towerId: string = "T1") {
  const allSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId)).all();
  return {
    total: allSpots.length,
    general: allSpots.filter(s => s.type === "GENERAL").length,
    reserved: allSpots.filter(s => s.type === "RESERVED").length,
    towerId
  };
}

export async function updateSpotCounts(totalCount: number, towerId: string = "T1") {
  const allSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId)).all();
  const currentCount = allSpots.length;

  db.transaction((tx) => {
    if (totalCount > currentCount) {
      // Add new spots as General by default
      for (let i = currentCount + 1; i <= totalCount; i++) {
        tx.insert(parkingSpots).values({
          code: `${towerId}-${i.toString().padStart(2, '0')}`,
          towerId,
          type: "GENERAL",
          isOccupied: false
        }).run();
      }
    } else if (totalCount < currentCount) {
      // Remove from the end, but only if not occupied
      const toRemove = allSpots.slice(totalCount).reverse();
      for (const spot of toRemove) {
        if (!spot.isOccupied) {
          // Unassign staff if any
          tx.update(staffMembers).set({ assignedSpotId: null }).where(eq(staffMembers.assignedSpotId, spot.id)).run();
          tx.delete(parkingSpots).where(eq(parkingSpots.id, spot.id)).run();
        }
      }
    }

    // FINAL STEP: Sequential Renumbering (The "Fixed Asset" logic)
    // Ensures codes are always T1-01, T1-02... Regardless of history
    const finalSpots = tx.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId)).all().sort((a, b) => a.id - b.id);
    finalSpots.forEach((spot, idx) => {
      tx.update(parkingSpots)
        .set({ code: `${towerId}-${(idx + 1).toString().padStart(2, '0')}` })
        .where(eq(parkingSpots.id, spot.id))
        .run();
    });
  });

  safeRevalidate();
}

export async function toggleSpotType(spotId: number) {
  const spot = await db.select().from(parkingSpots).where(eq(parkingSpots.id, spotId)).get();
  if (!spot) return;

  const nextType = spot.type === "GENERAL" ? "RESERVED" : "GENERAL";

  db.transaction((tx) => {
    tx.update(parkingSpots)
      .set({ type: nextType })
      .where(eq(parkingSpots.id, spotId))
      .run();

    if (nextType === "GENERAL") {
      tx.update(staffMembers)
        .set({ assignedSpotId: null })
        .where(eq(staffMembers.assignedSpotId, spotId))
        .run();
    }
  });

  safeRevalidate();
}

export async function updateSpotMonthlyFee(spotId: number, fee: number) {
  await db.update(parkingSpots)
    .set({ monthlyFee: fee })
    .where(eq(parkingSpots.id, spotId))
    .run();
  safeRevalidate();
}

export async function getTrialStatus() {
  const existing = await db.select().from(settings).where(eq(settings.key, "install_date")).get();
  const now = Math.floor(Date.now() / 1000);

  if (!existing) {
    // First run, set the install date
    await db.insert(settings).values({ key: "install_date", value: now.toString() }).run();
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
  const result = await db.select({
    user: users,
    access: accesses
  })
    .from(users)
    .leftJoin(accesses, eq(users.accessId, accesses.id))
    .where(eq(users.username, username))
    .get();

  if (result && result.user.password === password) {
    const { password: _, ...userWithoutPassword } = result.user;
    return {
      success: true,
      user: {
        ...userWithoutPassword,
        accessName: result.access?.name
      }
    };
  }

  return { success: false, message: "Usuario o contraseña incorrectos" };
}

export async function getUsers() {
  return await db.select({
    user: users,
    access: accesses
  })
    .from(users)
    .leftJoin(accesses, eq(users.accessId, accesses.id))
    .all();
}

export async function getAccesses() {
  return await db.select().from(accesses).all();
}

export async function getCameras() {
  return await db.select({
    camera: cameras,
    access: accesses
  })
    .from(cameras)
    .leftJoin(accesses, eq(cameras.accessId, accesses.id))
    .all();
}

export async function createUser(data: typeof users.$inferInsert) {
  try {
    await db.insert(users).values(data).run();
    safeRevalidate();
    return { success: true };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: "Error al crear el usuario. Probablemente el nombre o email ya existen." };
  }
}

export async function deleteUser(userId: string) {
  try {
    await db.delete(users).where(eq(users.id, userId)).run();
    safeRevalidate();
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: "Error al eliminar el usuario." };
  }
}

