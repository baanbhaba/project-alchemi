import { defineConfig } from "@prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

try {
  process.loadEnvFile?.();
} catch {}

// DATABASE_URL must be set in .env (never commit that file)
const dbUrl = process.env.DATABASE_URL || "postgresql://alchemi:alchemi@localhost:5432/alchemi_dev";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  earlyAccess: true,
  migrations: {
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    url: dbUrl,
    adapter: () => {
      const pool = new Pool({ connectionString: dbUrl });
      return new PrismaPg(pool);
    },
  },
});
