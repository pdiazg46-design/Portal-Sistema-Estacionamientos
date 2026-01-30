import { pgTable, text as pgText, integer as pgInteger, timestamp as pgTimestamp, boolean as pgBoolean, serial as pgSerial } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const isPostgres = !!process.env.POSTGRES_URL;

// --- Helper Types for Compatibility ---
// We export the "Active" table definitions.

const pgAccesses = pgTable("accesses", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: pgText("name").notNull(),
  createdAt: pgTimestamp("created_at").notNull().default(sql`now()`),
});

const sqliteAccesses = sqliteTable("accesses", {
  id: sqliteText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: sqliteText("name").notNull(),
  createdAt: sqliteInteger("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const accesses = (isPostgres ? pgAccesses : sqliteAccesses) as any;

const pgCameras = pgTable("cameras", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceName: pgText("device_name").unique().notNull(),
  accessId: pgText("access_id").notNull().references(() => accesses.id), // References proxy
  type: pgText("type", { enum: ["ENTRY", "EXIT", "BOTH"] }).notNull(),
});

const sqliteCameras = sqliteTable("cameras", {
  id: sqliteText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceName: sqliteText("device_name").unique().notNull(),
  accessId: sqliteText("access_id").notNull().references(() => accesses.id), // References proxy works via Drizzle object logic usually
  type: sqliteText("type").notNull(), // SQLite doesn't enforce enum in same way, keep as text
});

export const cameras = (isPostgres ? pgCameras : sqliteCameras) as any;

const pgParkingSpots = pgTable("parking_spots", {
  id: pgSerial("id").primaryKey(),
  code: pgText("code").notNull(),
  accessId: pgText("access_id").references(() => accesses.id),
  towerId: pgText("tower_id").default("T1").notNull(),
  type: pgText("type", { enum: ["RESERVED", "GENERAL"] }).notNull(),
  isOccupied: pgBoolean("is_occupied").default(false).notNull(),
  reservedForId: pgText("reserved_for_id"),
  monthlyFee: pgInteger("monthly_fee"),
});

const sqliteParkingSpots = sqliteTable("parking_spots", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  code: sqliteText("code").notNull(),
  accessId: sqliteText("access_id").references(() => accesses.id),
  towerId: sqliteText("tower_id").default("T1").notNull(),
  type: sqliteText("type").notNull(),
  isOccupied: sqliteInteger("is_occupied", { mode: 'boolean' }).default(false).notNull(),
  reservedForId: sqliteText("reserved_for_id"),
  monthlyFee: sqliteInteger("monthly_fee"),
});

export const parkingSpots = (isPostgres ? pgParkingSpots : sqliteParkingSpots) as any;

const pgStaffMembers = pgTable("staff_members", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: pgText("name").notNull(),
  role: pgText("role").notNull(),
  licensePlate: pgText("license_plate").unique().notNull(),
  phoneNumber: pgText("phone_number"),
  assignedSpotId: pgInteger("assigned_spot_id").references(() => parkingSpots.id),
  vacationStart: pgTimestamp("vacation_start"),
  vacationEnd: pgTimestamp("vacation_end"),
});

const sqliteStaffMembers = sqliteTable("staff_members", {
  id: sqliteText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: sqliteText("name").notNull(),
  role: sqliteText("role").notNull(),
  licensePlate: sqliteText("license_plate").unique().notNull(),
  phoneNumber: sqliteText("phone_number"),
  assignedSpotId: sqliteInteger("assigned_spot_id").references(() => parkingSpots.id),
  vacationStart: sqliteInteger("vacation_start", { mode: 'timestamp' }),
  vacationEnd: sqliteInteger("vacation_end", { mode: 'timestamp' }),
});

export const staffMembers = (isPostgres ? pgStaffMembers : sqliteStaffMembers) as any;

const pgParkingRecords = pgTable("parking_records", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  licensePlate: pgText("license_plate").notNull(),
  entryAccessId: pgText("entry_access_id").references(() => accesses.id),
  exitAccessId: pgText("exit_access_id").references(() => accesses.id),
  towerId: pgText("tower_id").default("T1").notNull(),
  entryTime: pgTimestamp("entry_time").notNull().default(sql`now()`),
  exitTime: pgTimestamp("exit_time"),
  spotId: pgInteger("spot_id").references(() => parkingSpots.id),
  entryType: pgText("entry_type", { enum: ["AUTOMATIC", "MANUAL"] }).notNull(),
  cost: pgInteger("cost"),
});

const sqliteParkingRecords = sqliteTable("parking_records", {
  id: sqliteText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  licensePlate: sqliteText("license_plate").notNull(),
  entryAccessId: sqliteText("entry_access_id").references(() => accesses.id),
  exitAccessId: sqliteText("exit_access_id").references(() => accesses.id),
  towerId: sqliteText("tower_id").default("T1").notNull(),
  entryTime: sqliteInteger("entry_time", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  exitTime: sqliteInteger("exit_time", { mode: 'timestamp' }),
  spotId: sqliteInteger("spot_id").references(() => parkingSpots.id),
  entryType: sqliteText("entry_type").notNull(),
  cost: sqliteInteger("cost"),
});

export const parkingRecords = (isPostgres ? pgParkingRecords : sqliteParkingRecords) as any;

const pgSettings = pgTable("settings", {
  id: pgSerial("id").primaryKey(),
  key: pgText("key").unique().notNull(),
  value: pgText("value").notNull(),
});

const sqliteSettings = sqliteTable("settings", {
  id: sqliteInteger("id").primaryKey({ autoIncrement: true }),
  key: sqliteText("key").unique().notNull(),
  value: sqliteText("value").notNull(),
});

export const settings = (isPostgres ? pgSettings : sqliteSettings) as any;

const pgUsers = pgTable("users", {
  id: pgText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: pgText("username").unique().notNull(),
  password: pgText("password").notNull(),
  email: pgText("email").unique(),
  accessId: pgText("access_id").references(() => accesses.id),
  role: pgText("role", { enum: ["SUPER_ADMIN", "ADMIN", "OPERATOR"] }).notNull().default("OPERATOR"),
  createdAt: pgTimestamp("created_at").notNull().default(sql`now()`),
});

const sqliteUsers = sqliteTable("users", {
  id: sqliteText("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: sqliteText("username").unique().notNull(),
  password: sqliteText("password").notNull(),
  email: sqliteText("email").unique(),
  accessId: sqliteText("access_id").references(() => accesses.id),
  role: sqliteText("role").notNull().default("OPERATOR"),
  createdAt: sqliteInteger("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const users = (isPostgres ? pgUsers : sqliteUsers) as any;

