import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

try {
  process.loadEnvFile?.();
} catch {}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  // ── Admin consumer account ─────────────────────────────────────────────────
  // Credentials: admin / admin
  // Role: admin (standard consumer, no dev mode)
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: hashPassword("admin") },
    create: {
      username: "admin",
      email: "admin@alchemi.dev",
      passwordHash: hashPassword("admin"),
      role: "admin",
    },
  });
  console.log(`✅ Seeded admin user:      ${admin.username} (${admin.id})`);

  // ── Dev superuser account ──────────────────────────────────────────────────
  // Credentials: baanbhaba / baanbhaba
  // Role: developer (triggers devMode in frontend — full NVIDIA NIM access)
  // Note: This account is also hardcoded client-side and never requires DB auth.
  const dev = await prisma.user.upsert({
    where: { username: "baanbhaba" },
    update: { passwordHash: hashPassword("baanbhaba"), role: "developer" },
    create: {
      username: "baanbhaba",
      email: "baanbhaba@alchemi.dev",
      passwordHash: hashPassword("baanbhaba"),
      role: "developer",
    },
  });
  console.log(`✅ Seeded dev user:        ${dev.username} (${dev.id})`);

  console.log("\n── ALCHEMI Account Summary ────────────────────────────────");
  console.log("  Consumer (admin):  username=admin     password=admin");
  console.log("  Dev (superuser):   username=baanbhaba password=baanbhaba");
  console.log("────────────────────────────────────────────────────────────\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
