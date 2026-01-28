
import { processVehicleEntry } from "../src/lib/actions";
import { db } from "../src/lib/db";
import { parkingSpots } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function main() {
  const plate = "ABC-105"; // Funcionario 5
  
  // Ensure spot is free first
  await db.update(parkingSpots).set({ isOccupied: false }).where(eq(parkingSpots.id, 5));
  
  console.log(`Testing entry for ${plate}...`);
  const result = await processVehicleEntry(plate);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main();

