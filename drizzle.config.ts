import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local runs read .env.local (Next.js convention); CI/hosted runs use real env vars.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
