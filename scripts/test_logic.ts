
import { processVehicleEntry } from "../src/lib/actions";

async function main() {
  try {
    console.log("Testing processVehicleEntry(ABC-102)...");
    const result = await processVehicleEntry("ABC-102");
    console.log("Result:", result);
  } catch (error) {
    console.error("CRITICAL ERROR:", error);
  }
}

main();

