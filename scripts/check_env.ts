
import dotenv from "dotenv";
import path from "path";

// Try loading .env.local
const envPath = path.join(process.cwd(), '.env.local');
console.log("Loading env from:", envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
}

console.log("Loaded keys:", Object.keys(process.env).filter(k => k.includes("POSTGRES") || k.includes("DATABASE")));

// Check specific standard Vercel keys
console.log("POSTGRES_URL exists?", !!process.env.POSTGRES_URL);
console.log("POSTGRES_PRISMA_URL exists?", !!process.env.POSTGRES_PRISMA_URL);
console.log("POSTGRES_URL_NON_POOLING exists?", !!process.env.POSTGRES_URL_NON_POOLING);
