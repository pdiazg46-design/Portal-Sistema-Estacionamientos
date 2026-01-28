
import { db } from "./db";
import { parkingSpots, staffMembers } from "./schema";

async function main() {
  console.log("Seeding database...");
  
  // 1. Create 80 Parking Spots
  const spots: typeof parkingSpots.$inferInsert[] = [];
  
  for (let i = 1; i <= 30; i++) {
    spots.push({
      id: i,
      code: `R-${i.toString().padStart(2, "0")}`,
      type: "RESERVED",
      isOccupied: false,
    });
  }
  
  for (let i = 31; i <= 80; i++) {
    spots.push({
      id: i,
      code: `G-${i.toString().padStart(2, "0")}`,
      type: "GENERAL",
      isOccupied: false,
    });
  }
  
  await db.insert(parkingSpots).values(spots).onConflictDoNothing();
  console.log("Created 80 parking spots.");

  // 2. Create Mock Staff
  const staff: typeof staffMembers.$inferInsert[] = [];
  
  for (let i = 1; i <= 15; i++) {
    staff.push({
      name: `Funcionario ${i}`,
      role: "Docente",
      licensePlate: `ABC-${100 + i}`,
      phoneNumber: `+569 9${i}123456`, // Mock Phone Number
      assignedSpotId: i, 
    });
  }
  
  await db.insert(staffMembers).values(staff).onConflictDoNothing();
  console.log("Created 15 mock staff members with phones.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

