import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/lib/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function setSuperAdmin() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("No DATABASE_URL found");
        process.exit(1);
    }
    const sql = postgres(connectionString);
    const db = drizzle(sql);

    console.log("Updating admin user...");
    await db.update(users).set({ role: "SUPER_ADMIN" }).where(eq(users.username, "admin"));

    const allUsers = await db.select().from(users);
    console.log("Current users:", allUsers.map(u => ({ username: u.username, role: u.role })));

    process.exit(0);
}

setSuperAdmin().catch(console.error);
