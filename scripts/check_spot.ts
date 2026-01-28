
import { db } from "../src/lib/db";
import { parkingSpots } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function main() {
  const spot = await db.select().from(parkingSpots).where(eq(parkingSpots.id, 2));
  console.log("Spot 2 Status:", spot);
}
main();

