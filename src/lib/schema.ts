import { pgTable, text, integer, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accesses = pgTable("accesses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(), // e.g., "Puerta Norte", "Acceso Principal"
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const cameras = pgTable("cameras", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceName: text("device_name").unique().notNull(), // Exact name from Hikvision
  accessId: text("access_id").notNull().references(() => accesses.id),
  type: text("type", { enum: ["ENTRY", "EXIT"] }).notNull(),
});

export const parkingSpots = pgTable("parking_spots", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  accessId: text("access_id").references(() => accesses.id), // Link spot to a specific gate
  towerId: text("tower_id").default("T1").notNull(),
  type: text("type", { enum: ["RESERVED", "GENERAL"] }).notNull(),
  isOccupied: boolean("is_occupied").default(false).notNull(),
  reservedForId: text("reserved_for_id"),
  monthlyFee: integer("monthly_fee"),
});

export const staffMembers = pgTable("staff_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  role: text("role").notNull(),
  licensePlate: text("license_plate").unique().notNull(),
  phoneNumber: text("phone_number"), // Added Phone Number
  assignedSpotId: integer("assigned_spot_id").references(() => parkingSpots.id),
  vacationStart: timestamp("vacation_start"),
  vacationEnd: timestamp("vacation_end"),
});

export const parkingRecords = pgTable("parking_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  licensePlate: text("license_plate").notNull(),
  entryAccessId: text("entry_access_id").references(() => accesses.id), // Gate where vehicle entered
  exitAccessId: text("exit_access_id").references(() => accesses.id),  // Gate where vehicle exited
  towerId: text("tower_id").default("T1").notNull(),
  entryTime: timestamp("entry_time").notNull().default(sql`now()`),
  exitTime: timestamp("exit_time"),
  spotId: integer("spot_id").references(() => parkingSpots.id),
  entryType: text("entry_type", { enum: ["AUTOMATIC", "MANUAL"] }).notNull(),
  cost: integer("cost"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  email: text("email").unique(),
  accessId: text("access_id").references(() => accesses.id), // Assigned gate for Operators
  role: text("role", { enum: ["SUPER_ADMIN", "ADMIN", "OPERATOR"] }).notNull().default("OPERATOR"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

