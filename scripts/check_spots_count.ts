
import { db } from "../src/lib/db";
import { parkingSpots } from "../src/lib/schema";
import { sql } from "drizzle-orm";

async function main() {
  const count = await db.select({ count: sql<number>`count(*)` }).from(parkingSpots);
  console.log("Spot Count:", count[0].count);
}
main();

