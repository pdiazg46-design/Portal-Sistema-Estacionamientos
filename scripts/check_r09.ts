
import { db } from "../src/lib/db";
import { staffMembers } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Checking R-09 (ID 9)...");
  // Assuming R-09 is ID 9 (based on seed: 1-30 are Reserved)
  const staff = await db.select().from(staffMembers).where(eq(staffMembers.assignedSpotId, 9));
  console.log("Staff assigned to R-09:", JSON.stringify(staff, null, 2));
}

main();

