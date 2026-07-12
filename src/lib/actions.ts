"use server";

import { db } from "./db";
import { parkingSpots, staffMembers, parkingRecords, settings, users, accesses, cameras } from "./schema";
import { eq, and, or, isNull, lte, gte, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getActiveOwnerHelper, normalizePlate, getChileDate, getChileDateString } from "./utils";

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
    logoUrl: "/at-sit-logo.png",
    releaseReservedSpots: "false",
    releaseReservedTime: "20:00"
  };

  try {
    const allSettings = await db.select().from(settings);
    allSettings.forEach((s: any) => {
      if (s.key === "company_name" && s.value) branding.companyName = s.value;
      if (s.key === "system_name" && s.value) branding.systemName = s.value;
      if (s.key === "description" && s.value) branding.description = s.value;
      if (s.key === "release_reserved_spots" && s.value) branding.releaseReservedSpots = s.value;
      if (s.key === "release_reserved_time" && s.value) branding.releaseReservedTime = s.value;
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

export async function updateBranding(data: { 
  companyName?: string, 
  systemName?: string, 
  description?: string, 
  logoUrl?: string,
  releaseReservedSpots?: string,
  releaseReservedTime?: string
}) {
  const entries = [
    { key: "company_name", value: data.companyName },
    { key: "system_name", value: data.systemName },
    { key: "description", value: data.description },
    { key: "logo_url", value: data.logoUrl },
    { key: "release_reserved_spots", value: data.releaseReservedSpots },
    { key: "release_reserved_time", value: data.releaseReservedTime }
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
  const today = getChileDate();
  const normalizedPlate = normalizePlate(licensePlate);

  const staffResults = await db.select().from(staffMembers).where(eq(staffMembers.licensePlate, normalizedPlate));
  const staff = staffResults[0];

  if (staff) {
    const onVacation = staff.vacationStart && staff.vacationEnd &&
      getChileDate(new Date(staff.vacationStart)) <= today && getChileDate(new Date(staff.vacationEnd)) >= today;

    let isReleasedToday = false;
    if (staff.releasedDates) {
      const todayStr = getChileDateString();
      if (staff.releasedDates.split(",").includes(todayStr)) {
        isReleasedToday = true;
      }
    }

    let isScheduledNow = true;
    if (!staff.isAllDay) {
      const currentDayNum = today.getDay();
      const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const currentDayName = weekdayNames[currentDayNum];

      const allowedDays = staff.weekdays ? staff.weekdays.split(",") : [];
      if (!allowedDays.includes(currentDayName)) {
        isScheduledNow = false;
      } else if (staff.startTime && staff.endTime) {
        const [startH, startM] = staff.startTime.split(":").map(Number);
        const [endH, endM] = staff.endTime.split(":").map(Number);

        const currentH = today.getHours();
        const currentM = today.getMinutes();

        const currentMins = currentH * 60 + currentM;
        const startMins = startH * 60 + startM;
        const endMins = endH * 60 + endM;

        if (currentMins < startMins || currentMins > endMins) {
          isScheduledNow = false;
        }
      }
    }

    const isActive = !onVacation && !isReleasedToday && isScheduledNow;

    if (isActive && staff.assignedSpotId) {
      // Check spot status
      const spotResults = await db.select().from(parkingSpots).where(eq(parkingSpots.id, staff.assignedSpotId));
      const spot = spotResults[0];

      if (spot && !spot.isOccupied) {
        await occupySpot(spot.id, normalizedPlate, "AUTOMATIC", accessId);
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
    } else {
      let failMessage = "";
      if (onVacation) {
        failMessage = `Abonado ${staff.name} está de vacaciones. Asignar como Visita.`;
      } else if (isReleasedToday) {
        failMessage = `Abonado ${staff.name} liberó su reserva para el día de hoy. Asignar como Visita.`;
      } else if (!isScheduledNow) {
        failMessage = `Abonado ${staff.name} fuera de su horario de reserva (${staff.startTime || "00:00"} - ${staff.endTime || "00:00"}). Asignar como Visita.`;
      } else {
        failMessage = `Abonado ${staff.name} no tiene reserva activa hoy. Asignar como Visita.`;
      }
      return {
        allowed: false,
        message: failMessage,
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



export async function occupySpot(spotId: number, licensePlate: string, type: "AUTOMATIC" | "MANUAL", accessId?: string, visitorName?: string, entryComments?: string) {
  const normalizedPlate = normalizePlate(licensePlate);
  console.log(`[Action] Attempting occupySpot: Spot ${spotId}, Plate ${normalizedPlate}, Type ${type}`);
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
        licensePlate: normalizedPlate,
        spotId,
        entryType: type,
        entryAccessId: accessId,
        entryTime: new Date(),
        visitorName: visitorName || null,
        entryComments: entryComments || null
      });
    });
    console.log(`[Action] Successfully occupied spot ${spotId} with plate ${normalizedPlate}`);

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
    entryTime: null as string | null,
    exitTime: null as string | null
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
        entryTime: entryTimeObj ? entryTimeObj.toISOString() : null,
        exitTime: exitTime ? exitTime.toISOString() : null
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

export async function updateSpotAssignment(
  spotId: number, 
  data: { 
    id?: string;
    name: string; 
    plate: string; 
    phone: string; 
    vacationStart?: Date | null; 
    vacationEnd?: Date | null;
    isAllDay?: boolean;
    weekdays?: string;
    startTime?: string;
    endTime?: string;
    releasedDates?: string;
  }
) {
  const normalizedPlate = normalizePlate(data.plate);

  await db.transaction(async (tx: any) => {
    if (data.id) {
      await tx.update(staffMembers)
        .set({
          name: data.name,
          licensePlate: normalizedPlate,
          phoneNumber: data.phone,
          vacationStart: data.vacationStart,
          vacationEnd: data.vacationEnd,
          isAllDay: data.isAllDay !== undefined ? data.isAllDay : true,
          weekdays: data.weekdays || null,
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          releasedDates: data.releasedDates || null
        })
        .where(eq(staffMembers.id, data.id));
    } else {
      await tx.insert(staffMembers).values({
        name: data.name,
        licensePlate: normalizedPlate,
        phoneNumber: data.phone,
        role: "Abonado",
        assignedSpotId: spotId,
        vacationStart: data.vacationStart,
        vacationEnd: data.vacationEnd,
        isAllDay: data.isAllDay !== undefined ? data.isAllDay : true,
        weekdays: data.weekdays || null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        releasedDates: data.releasedDates || null
      });
    }

    // Set spot type to RESERVED
    await tx.update(parkingSpots)
      .set({ type: "RESERVED" })
      .where(eq(parkingSpots.id, spotId));
  });
  safeRevalidate();
}

export async function removeStaffMember(staffId: string) {
  await db.transaction(async (tx: any) => {
    const staff = (await tx.select().from(staffMembers).where(eq(staffMembers.id, staffId)))[0];
    
    await tx.update(staffMembers)
      .set({ assignedSpotId: null })
      .where(eq(staffMembers.id, staffId));

    if (staff && staff.assignedSpotId) {
      const remaining = await tx.select().from(staffMembers).where(eq(staffMembers.assignedSpotId, staff.assignedSpotId));
      if (remaining.length === 0) {
        await tx.update(parkingSpots)
          .set({ type: "GENERAL" })
          .where(eq(parkingSpots.id, staff.assignedSpotId));
      }
    }
  });
  safeRevalidate();
}

export async function removeSpotAssignment(spotId: number) {
  await db.transaction(async (tx: any) => {
    await tx.update(staffMembers)
      .set({ assignedSpotId: null })
      .where(eq(staffMembers.assignedSpotId, spotId));

    await tx.update(parkingSpots)
      .set({ type: "GENERAL" })
      .where(eq(parkingSpots.id, spotId));
  });
  safeRevalidate();
}



export async function processVehicleExit(licensePlate: string, accessId: string) {
  const normalizedPlate = normalizePlate(licensePlate);
  const activeRecordResults = await db.select().from(parkingRecords)
    .where(and(eq(parkingRecords.licensePlate, normalizedPlate), isNull(parkingRecords.exitTime)));
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
  let releaseActive = false;
  try {
    const allSettings = await db.select().from(settings);
    const releaseReservedSpots = allSettings.find((s: any) => s.key === "release_reserved_spots")?.value === "true";
    const releaseReservedTime = allSettings.find((s: any) => s.key === "release_reserved_time")?.value || "20:00";
    
    if (releaseReservedSpots) {
      const [hours, minutes] = releaseReservedTime.split(":").map(Number);
      const now = getChileDate();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const nowMins = currentHours * 60 + currentMinutes;
      const releaseMins = hours * 60 + minutes;
      if (nowMins >= releaseMins) {
        releaseActive = true;
      }
    }
  } catch (e) {
    console.error("Error reading release settings in LPR:", e);
  }

  let allSpots = [];
  let allStaff = [];
  try {
    allSpots = await db.select().from(parkingSpots);
    allStaff = await db.select().from(staffMembers);
  } catch (e) {
    console.error("Error fetching spots or staff in LPR:", e);
    return [];
  }

  const today = getChileDate();

  const availableSpots = allSpots.filter((spot: any) => {
    if (spot.isOccupied) return false;

    if (accessId && accessId !== "ALL") {
      if (spot.accessId && spot.accessId !== accessId) return false;
    }

    if (spot.type === "GENERAL") return true;

    // Spot is RESERVED:
    const activeOwner = getActiveOwnerHelper(spot.id, allStaff);
    if (!activeOwner) {
      return true; // No active owner right now -> Free!
    }

    if (releaseActive) {
      // General release is active. Only release all-day spots, respect custom scheduled ones!
      return activeOwner.isAllDay === true;
    }

    return false;
  });

  return availableSpots.sort((a: any, b: any) => a.id - b.id);
}

export async function getSpotCounts(towerId: string = "T1") {
  const allSpots = await db.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId));
  
  const levels = {
    "-1": allSpots.filter((s: any) => s.level === "-1").length,
    "-2": allSpots.filter((s: any) => s.level === "-2").length,
    "-3": allSpots.filter((s: any) => s.level === "-3").length
  };

  return {
    total: allSpots.length,
    general: allSpots.filter((s: any) => s.type === "GENERAL").length,
    reserved: allSpots.filter((s: any) => s.type === "RESERVED").length,
    levels,
    towerId
  };
}

export async function updateSpotCounts(
  levelsConfig: Record<string, number>, 
  towerId: string = "T1",
  gateId?: string
) {
  let targetGateId = gateId || null;
  if (!targetGateId) {
    const gateMapping: Record<string, string> = {
      "T1": "gate-1",
      "T2": "gate-2",
      "T3": "gate-3"
    };
    targetGateId = gateMapping[towerId] || null;
  }

  await db.transaction(async (tx: any) => {
    const allSpots = await tx.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId));

    // We process all levels provided in the config
    const levelsToProcess = Object.keys(levelsConfig);

    for (const lvl of levelsToProcess) {
      const targetCount = levelsConfig[lvl] || 0;
      const levelSpots = allSpots.filter((s: any) => s.level === lvl);
      const currentCount = levelSpots.length;

      if (targetCount > currentCount) {
        // Add new spots to this level (Optimized: Batch Insert)
        const spotsToAdd = [];
        for (let i = currentCount + 1; i <= targetCount; i++) {
          spotsToAdd.push({
            code: `${towerId}-TEMP`, // Code will be renumbered below
            towerId,
            level: lvl,
            accessId: targetGateId,
            type: "GENERAL",
            isOccupied: false
          });
        }
        if (spotsToAdd.length > 0) {
          await tx.insert(parkingSpots).values(spotsToAdd);
        }
      } else if (targetCount < currentCount) {
        // Remove spots from the end of this level, but only if not occupied
        const toRemove = levelSpots.slice(targetCount).reverse();
        for (const spot of toRemove) {
          if (!spot.isOccupied) {
            // Unassign staff if any
            await tx.update(staffMembers).set({ assignedSpotId: null }).where(eq(staffMembers.assignedSpotId, spot.id));
            // Decouple historical parking records
            await tx.update(parkingRecords).set({ spotId: null }).where(eq(parkingRecords.spotId, spot.id));
            await tx.delete(parkingSpots).where(eq(parkingSpots.id, spot.id));
          }
        }
      }
    }

    // Deleting any level in DB that is set to 0 or missing from config entirely
    const existingLevelsInDB = Array.from(new Set(allSpots.map((s: any) => s.level || "-1")));
    for (const lvl of existingLevelsInDB) {
      if (!(lvl in levelsConfig)) {
        const levelSpots = allSpots.filter((s: any) => s.level === lvl);
        for (const spot of levelSpots) {
          if (!spot.isOccupied) {
            await tx.update(staffMembers).set({ assignedSpotId: null }).where(eq(staffMembers.assignedSpotId, spot.id));
            // Decouple historical parking records
            await tx.update(parkingRecords).set({ spotId: null }).where(eq(parkingRecords.spotId, spot.id));
            await tx.delete(parkingSpots).where(eq(parkingSpots.id, spot.id));
          }
        }
      }
    }

    // FINAL STEP: Sequential Renumbering across the entire tower!
    const finalSpots = (await tx.select().from(parkingSpots).where(eq(parkingSpots.towerId, towerId)));
    finalSpots.sort((a: any, b: any) => {
      const lvlA = parseInt(a.level || "-1");
      const lvlB = parseInt(b.level || "-1");
      const isNumA = !isNaN(lvlA);
      const isNumB = !isNaN(lvlB);
      
      if (isNumA && isNumB) {
        if (lvlA !== lvlB) return lvlB - lvlA; // Descending (e.g. -1 first, then -2, then -3)
      } else {
        if (a.level !== b.level) {
          return (a.level || "").localeCompare(b.level || "");
        }
      }
      return a.id - b.id;
    });

    // Optimized: Only run UPDATE queries if the code or accessId actually changed!
    for (const [idx, spot] of finalSpots.entries()) {
      const expectedCode = `${towerId}-${(idx + 1).toString().padStart(2, '0')}`;
      if (spot.code !== expectedCode || spot.accessId !== targetGateId) {
        await tx.update(parkingSpots)
          .set({
            code: expectedCode,
            accessId: targetGateId
          })
          .where(eq(parkingSpots.id, spot.id));
      }
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
  return {
    expired: false,
    daysLeft: 9999
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
      .where(sql`LOWER(${users.username}) = LOWER(${username})`))[0];

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

export async function getAllTowers() {
  const spots = await db.select({
    towerId: parkingSpots.towerId,
    accessId: parkingSpots.accessId
  }).from(parkingSpots);

  const uniqueTowers: Record<string, string> = {};
  for (const s of spots) {
    if (s.towerId) {
      uniqueTowers[s.towerId] = s.accessId || "";
    }
  }

  // Only if the database is completely empty of towers, we initialize T1 as default
  if (Object.keys(uniqueTowers).length === 0) {
    uniqueTowers["T1"] = "gate-1";
  }

  return uniqueTowers;
}

export async function renameTower(oldTowerId: string, newTowerId: string) {
  await db.transaction(async (tx: any) => {
    // Update all parking spots towerId
    await tx.update(parkingSpots)
      .set({ towerId: newTowerId })
      .where(eq(parkingSpots.towerId, oldTowerId));

    const spots = await tx.select().from(parkingSpots).where(eq(parkingSpots.towerId, newTowerId));
    
    // Sort spots
    spots.sort((a: any, b: any) => {
      const lvlA = parseInt(a.level || "-1");
      const lvlB = parseInt(b.level || "-1");
      const isNumA = !isNaN(lvlA);
      const isNumB = !isNaN(lvlB);
      
      if (isNumA && isNumB) {
        if (lvlA !== lvlB) return lvlB - lvlA;
      } else {
        if (a.level !== b.level) {
          return (a.level || "").localeCompare(b.level || "");
        }
      }
      return a.id - b.id;
    });

    // Update spot codes to match the new prefix
    for (const [idx, spot] of spots.entries()) {
      await tx.update(parkingSpots)
        .set({ code: `${newTowerId}-${(idx + 1).toString().padStart(2, '0')}` })
        .where(eq(parkingSpots.id, spot.id));
    }
  });

  safeRevalidate();
}

export async function getLastBulkUpload() {
  try {
    const result = (await db.select().from(settings).where(eq(settings.key, "last_bulk_upload")))[0];
    if (result && result.value) {
      return JSON.parse(result.value);
    }
  } catch (e) {
    console.error("Error reading last bulk upload metadata:", e);
  }
  return null;
}

export async function bulkUploadStaff(csvText: string, overwriteAll: boolean, username: string) {
  try {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) {
      return { success: false, errors: ["El archivo está vacío."], warnings: [] };
    }

    // Detect delimiter
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ",";
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ";";
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = "\t";
    }

    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const cleanHeader = (h: string) => {
      return h.toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\s+/g, "_")
        .trim();
    };

    const headers = parseLine(lines[0]).map(cleanHeader);
    const expectedHeaders = ["SITIO", "NOMBRE", "PATENTE"];
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return { 
        success: false, 
        errors: [`Columnas requeridas faltantes: ${missingHeaders.join(", ")}`], 
        warnings: [] 
      };
    }

    // Fetch all spots to map codes
    const spots = await db.select().from(parkingSpots);
    const spotMap = new Map<string, number>();
    spots.forEach((s: any) => {
      spotMap.set(s.code.toUpperCase(), s.id);
    });

    const parsedRows: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Helper functions
    const parseDateHelper = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      const cleaned = dateStr.trim();
      if (!cleaned) return null;

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        const d = new Date(cleaned + "T00:00:00");
        return isNaN(d.getTime()) ? null : d;
      }
      // DD-MM-YYYY or DD/MM/YYYY
      const match = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (match) {
        const dd = match[1].padStart(2, "0");
        const mm = match[2].padStart(2, "0");
        const yyyy = match[3];
        const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(cleaned);
      return isNaN(d.getTime()) ? null : d;
    };

    const mapWeekdaysSpanish = (diasStr: string | undefined): string => {
      if (!diasStr) return "MON,TUE,WED,THU,FRI";
      const parts = diasStr.split(",").map(d => d.trim().toUpperCase());
      const mapping: { [key: string]: string } = {
        "LUN": "MON", "LUNES": "MON",
        "MAR": "TUE", "MARTES": "TUE",
        "MIE": "WED", "MIERCOLES": "WED", "MIÉRCOLES": "WED",
        "JUE": "THU", "JUEVES": "THU",
        "VIE": "FRI", "VIERNES": "FRI",
        "SAB": "SAT", "SABADO": "SAT", "SÁBADO": "SAT",
        "DOM": "SUN", "DOMINGO": "SUN"
      };
      const mapped = parts
        .map(p => mapping[p] || p)
        .filter(p => ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].includes(p));
      return mapped.length > 0 ? mapped.join(",") : "MON,TUE,WED,THU,FRI";
    };

    const formatPhoneNumber = (numStr: string): string => {
      let cleaned = numStr.trim();
      if (!cleaned) return "";
      
      // Expand scientific notation if detected (e.g. 5,6911E+10 or 5.6911E+10)
      if (/^\d+([.,]\d+)?E\+?\d+$/i.test(cleaned)) {
        const normalized = cleaned.replace(",", ".");
        const num = Number(normalized);
        if (!isNaN(num)) {
          return "+" + Math.round(num).toString();
        }
      }
      return cleaned;
    };

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index].trim() : "";
      });

      const lineNum = i + 1;
      const sitio = row["SITIO"] || "";
      const nombre = row["NOMBRE"] || "";
      const patente = row["PATENTE"] || "";
      const telefono = row["TELEFONO"] || "";
      const todoElDiaStr = (row["TODO_EL_DIA"] || row["TODO_EL_DJA"] || "SI").toUpperCase();
      const diasStr = row["DIAS"] || "";
      const horaInicio = row["HORA_INICIO"] || "";
      const horaFin = row["HORA_FIN"] || "";
      const vacDesdeStr = row["VACACIONES_DESDE"] || "";
      const vacHastaStr = row["VACACIONES_HASTA"] || "";
      const liberacionesStr = row["LIBERACIONES"] || "";

      // Validation
      if (!sitio) {
        errors.push(`Fila ${lineNum}: El campo SITIO es obligatorio.`);
        continue;
      }

      const spotId = spotMap.get(sitio.toUpperCase());
      if (!spotId) {
        errors.push(`Fila ${lineNum}: El sitio '${sitio}' no existe.`);
        continue;
      }

      if (!nombre) {
        errors.push(`Fila ${lineNum}: El campo NOMBRE es obligatorio.`);
        continue;
      }

      if (!patente) {
        errors.push(`Fila ${lineNum}: El campo PATENTE es obligatorio.`);
        continue;
      }

      const normalizedPlate = normalizePlate(patente);
      if (normalizedPlate.length < 4 || normalizedPlate.length > 10) {
        errors.push(`Fila ${lineNum}: La patente '${patente}' no tiene un formato válido.`);
        continue;
      }

      const isAllDay = todoElDiaStr === "SI" || todoElDiaStr === "YES" || todoElDiaStr === "TRUE";
      let weekdays = null;
      let startTime = null;
      let endTime = null;

      if (!isAllDay) {
        if (!horaInicio || !horaFin) {
          errors.push(`Fila ${lineNum}: Debes indicar HORA_INICIO y HORA_FIN si no es todo el día.`);
          continue;
        }
        weekdays = mapWeekdaysSpanish(diasStr);
        startTime = horaInicio;
        endTime = horaFin;
      }

      // Vacations
      let vacationStart: Date | null = null;
      let vacationEnd: Date | null = null;
      if (vacDesdeStr || vacHastaStr) {
        if (!vacDesdeStr || !vacHastaStr) {
          errors.push(`Fila ${lineNum}: Debes indicar tanto fecha de inicio como de fin para las vacaciones.`);
          continue;
        }
        const start = parseDateHelper(vacDesdeStr);
        const end = parseDateHelper(vacHastaStr);
        if (!start || !end) {
          errors.push(`Fila ${lineNum}: Formato de fecha de vacaciones inválido (use YYYY-MM-DD o DD-MM-YYYY).`);
          continue;
        }
        if (end < start) {
          errors.push(`Fila ${lineNum}: La fecha de fin de vacaciones no puede ser anterior a la de inicio.`);
          continue;
        }
        vacationStart = start;
        vacationEnd = end;
      }

      // Releases
      let releasedDates: string | null = null;
      if (liberacionesStr) {
        const dates = liberacionesStr.split(",").map(d => d.trim()).filter(d => d !== "");
        const validDates: string[] = [];
        let dateError = false;
        for (const d of dates) {
          const parsed = parseDateHelper(d);
          if (!parsed) {
            errors.push(`Fila ${lineNum}: Fecha de liberación '${d}' inválida (use YYYY-MM-DD o DD-MM-YYYY).`);
            dateError = true;
            break;
          }
          const yyyy = parsed.getFullYear();
          const mm = String(parsed.getMonth() + 1).padStart(2, "0");
          const dd = String(parsed.getDate()).padStart(2, "0");
          validDates.push(`${yyyy}-${mm}-${dd}`);
        }
        if (dateError) continue;
        releasedDates = validDates.sort().join(",");
      }

      parsedRows.push({
        spotId,
        sitio,
        name: nombre,
        plate: normalizedPlate,
        phone: formatPhoneNumber(telefono),
        isAllDay,
        weekdays,
        startTime,
        endTime,
        vacationStart,
        vacationEnd,
        releasedDates
      });
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    if (parsedRows.length === 0) {
      return { success: false, errors: ["No se encontraron filas de abonados válidas para procesar."], warnings };
    }

    // Plate uniqueness check
    const plateCounts = new Map<string, number>();
    parsedRows.forEach(r => {
      plateCounts.set(r.plate, (plateCounts.get(r.plate) || 0) + 1);
    });
    for (const [plate, count] of plateCounts.entries()) {
      if (count > 1) {
        errors.push(`La patente '${plate}' está duplicada en el archivo de carga.`);
      }
    }
    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    // Database transaction
    await db.transaction(async (tx: any) => {
      if (overwriteAll) {
        // Clear all staff members assignments
        await tx.update(staffMembers).set({ assignedSpotId: null });
      } else {
        // Clear assignments only for the spots mentioned in this CSV
        const spotIds = Array.from(new Set(parsedRows.map(r => r.spotId))) as number[];
        for (const spotId of spotIds) {
          await tx.update(staffMembers).set({ assignedSpotId: null }).where(eq(staffMembers.assignedSpotId, spotId));
        }
      }

      const loadedSpotIds = Array.from(new Set(parsedRows.map(r => r.spotId))) as number[];

      // Insert/Create new staff members and assign to spots
      for (const row of parsedRows) {
        // Check if staff member with this plate already exists
        const existingStaff = (await tx.select().from(staffMembers).where(eq(staffMembers.licensePlate, row.plate)))[0];
        if (existingStaff) {
          // Update details and link to spot
          await tx.update(staffMembers)
            .set({
              name: row.name,
              phoneNumber: row.phone,
              assignedSpotId: row.spotId,
              isAllDay: row.isAllDay,
              weekdays: row.weekdays,
              startTime: row.startTime,
              endTime: row.endTime,
              vacationStart: row.vacationStart,
              vacationEnd: row.vacationEnd,
              releasedDates: row.releasedDates
            })
            .where(eq(staffMembers.id, existingStaff.id));
        } else {
          // Create new staff member
          await tx.insert(staffMembers).values({
            name: row.name,
            role: "Abonado",
            licensePlate: row.plate,
            phoneNumber: row.phone,
            assignedSpotId: row.spotId,
            isAllDay: row.isAllDay,
            weekdays: row.weekdays,
            startTime: row.startTime,
            endTime: row.endTime,
            vacationStart: row.vacationStart,
            vacationEnd: row.vacationEnd,
            releasedDates: row.releasedDates
          });
        }
        
        // Update spot type to RESERVED
        await tx.update(parkingSpots).set({ type: "RESERVED" }).where(eq(parkingSpots.id, row.spotId));
      }

      if (overwriteAll) {
        // Set all spots not in loadedSpotIds to GENERAL
        const allSpots = await tx.select().from(parkingSpots);
        for (const spot of allSpots) {
          if (!loadedSpotIds.includes(spot.id)) {
            await tx.update(parkingSpots).set({ type: "GENERAL" }).where(eq(parkingSpots.id, spot.id));
          }
        }
      }
      
      // Log metadata to settings
      const uploadMetadata = {
        username,
        timestamp: new Date().toISOString(),
        successCount: parsedRows.length,
        overwriteAll
      };
      
      const existingSetting = (await tx.select().from(settings).where(eq(settings.key, "last_bulk_upload")))[0];
      if (existingSetting) {
        await tx.update(settings).set({ value: JSON.stringify(uploadMetadata) }).where(eq(settings.key, "last_bulk_upload"));
      } else {
        await tx.insert(settings).values({ key: "last_bulk_upload", value: JSON.stringify(uploadMetadata) });
      }
    });

    safeRevalidate();
    return { success: true, errors: [], warnings };
  } catch (e: any) {
    console.error("Bulk upload action failed:", e);
    return { success: false, errors: [`Error del servidor: ${e.message}`], warnings: [] };
  }
}

export async function exportCurrentAssignments() {
  try {
    const list = await db.select({
      spotCode: parkingSpots.code,
      name: staffMembers.name,
      licensePlate: staffMembers.licensePlate,
      phoneNumber: staffMembers.phoneNumber,
      isAllDay: staffMembers.isAllDay,
      weekdays: staffMembers.weekdays,
      startTime: staffMembers.startTime,
      endTime: staffMembers.endTime,
      vacationStart: staffMembers.vacationStart,
      vacationEnd: staffMembers.vacationEnd,
      releasedDates: staffMembers.releasedDates
    })
    .from(staffMembers)
    .innerJoin(parkingSpots, eq(staffMembers.assignedSpotId, parkingSpots.id));

    // Generate CSV content with semicolon delimiter
    const headers = [
      "SITIO", "NOMBRE", "PATENTE", "TELEFONO", "TODO_EL_DIA",
      "DIAS", "HORA_INICIO", "HORA_FIN",
      "VACACIONES_DESDE", "VACACIONES_HASTA", "LIBERACIONES"
    ];

    const formatDateStr = (date: any): string => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const mapWeekdaysToSpanish = (weekdaysStr: string | null | undefined): string => {
      if (!weekdaysStr) return "";
      const parts = weekdaysStr.split(",").map(d => d.trim().toUpperCase());
      const mapping: { [key: string]: string } = {
        "MON": "LUN", "TUE": "MAR", "WED": "MIE", "THU": "JUE", "FRI": "VIE", "SAT": "SAB", "SUN": "DOM"
      };
      return parts.map(p => mapping[p] || p).join(",");
    };

    const csvLines = [headers.join(";")];

    list.forEach((s: any) => {
      const todoElDiaVal = s.isAllDay ? "SI" : "NO";
      const row = [
        s.spotCode || "",
        s.name || "",
        s.licensePlate || "",
        s.phoneNumber || "",
        todoElDiaVal,
        mapWeekdaysToSpanish(s.weekdays),
        s.startTime || "",
        s.endTime || "",
        formatDateStr(s.vacationStart),
        formatDateStr(s.vacationEnd),
        s.releasedDates || ""
      ];
      // Escape quotes and join with semicolon
      const cleanRow = row.map(val => {
        const strVal = String(val);
        if (strVal.includes(";") || strVal.includes('"') || strVal.includes("\n")) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      csvLines.push(cleanRow.join(";"));
    });

    return csvLines.join("\n");
  } catch (e) {
    console.error("Failed to export current assignments:", e);
    throw new Error("No se pudo exportar la configuración actual.");
  }
}

export async function exportCurrentAssignmentsHTML() {
  try {
    const list = await db.select({
      spotCode: parkingSpots.code,
      name: staffMembers.name,
      licensePlate: staffMembers.licensePlate,
      phoneNumber: staffMembers.phoneNumber,
      isAllDay: staffMembers.isAllDay,
      weekdays: staffMembers.weekdays,
      startTime: staffMembers.startTime,
      endTime: staffMembers.endTime,
      vacationStart: staffMembers.vacationStart,
      vacationEnd: staffMembers.vacationEnd,
      releasedDates: staffMembers.releasedDates
    })
    .from(staffMembers)
    .innerJoin(parkingSpots, eq(staffMembers.assignedSpotId, parkingSpots.id));

    const branding = await getBranding();

    const formatDateStr = (date: any): string => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const mapWeekdaysToSpanish = (weekdaysStr: string | null | undefined): string => {
      if (!weekdaysStr) return "";
      const parts = weekdaysStr.split(",").map(d => d.trim().toUpperCase());
      const mapping: { [key: string]: string } = {
        "MON": "LUN", "TUE": "MAR", "WED": "MIE", "THU": "JUE", "FRI": "VIE", "SAT": "SAB", "SUN": "DOM"
      };
      return parts.map(p => mapping[p] || p).join(",");
    };

    let logoHtml = "";
    if (branding.logoUrl) {
      if (branding.logoUrl.startsWith("data:image")) {
        logoHtml = `<img src="${branding.logoUrl}" style="max-height: 60px; width: auto;" />`;
      } else if (branding.logoUrl.startsWith("/")) {
        logoHtml = `<img src="https://finisterrae.cl/wp-content/uploads/2021/04/logo-finis.png" style="max-height: 60px; width: auto;" />`;
      } else {
        logoHtml = `<img src="${branding.logoUrl}" style="max-height: 60px; width: auto;" />`;
      }
    }

    const htmlContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Abonados</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 20px; }
    .header-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
    .header-table td { border: none; padding: 10px; }
    .title { font-size: 22px; font-weight: 800; color: #1e3a8a; }
    .subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
    
    .data-table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    .data-table th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-size: 12px; text-transform: uppercase; padding: 10px; border: 1px solid #cbd5e1; text-align: left; }
    .data-table td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; color: #334155; }
    .data-table tr:nth-child(even) { background-color: #f8fafc; }
    .badge-si { background-color: #dcfce7; color: #15803d; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-align: center; }
    .badge-no { background-color: #fee2e2; color: #b91c1c; font-weight: bold; padding: 2px 6px; border-radius: 4px; text-align: center; }
  </style>
</head>
<body>

  <table class="header-table">
    <tr>
      <td style="width: 150px; text-align: center; vertical-align: middle;">
        ${logoHtml || `<span style="font-size: 24px;">🚗</span>`}
      </td>
      <td style="vertical-align: middle; padding-left: 20px;">
        <div class="title">${branding.companyName || "POCURO TORRE 1"}</div>
        <div class="subtitle">${branding.systemName || "Sistema de Control de Estacionamientos"}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 5px;">Reporte Generado: ${new Date().toLocaleString('es-CL')}</div>
      </td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th>Sitio</th>
        <th>Nombre Propietario</th>
        <th>Patente</th>
        <th>Teléfono</th>
        <th>Todo el Día (Fijo)</th>
        <th>Días</th>
        <th>Hora Inicio</th>
        <th>Hora Fin</th>
        <th>Vacaciones Desde</th>
        <th>Vacaciones Hasta</th>
        <th>Fechas Liberadas</th>
      </tr>
    </thead>
    <tbody>
      \${list.map((s: any) => \`
        <tr>
          <td style="font-weight: bold; color: #1e3a8a;">\${s.spotCode || ""}</td>
          <td style="font-weight: 600;">\${s.name || ""}</td>
          <td style="font-family: monospace; font-size: 13px; font-weight: bold; color: #475569;">\${s.licensePlate || ""}</td>
          <td>\${s.phoneNumber || ""}</td>
          <td style="text-align: center;">
            \${s.isAllDay 
              ? '<span class="badge-si">SÍ</span>' 
              : '<span class="badge-no">NO</span>'
            }
          </td>
          <td>\${mapWeekdaysToSpanish(s.weekdays)}</td>
          <td>\${s.startTime || ""}</td>
          <td>\${s.endTime || ""}</td>
          <td>\${formatDateStr(s.vacationStart)}</td>
          <td>\${formatDateStr(s.vacationEnd)}</td>
          <td>\${s.releasedDates || ""}</td>
        </tr>
      \`).join("")}
    </tbody>
  </table>

</body>
</html>
    `;

    return htmlContent;
  } catch (e) {
    console.error("Failed to export current assignments as HTML:", e);
    throw new Error("No se pudo exportar la plantilla con diseño.");
  }
}
