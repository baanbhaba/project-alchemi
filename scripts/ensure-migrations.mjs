import { execFileSync } from "node:child_process";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");

try {
  process.loadEnvFile?.();
} catch {}

if (!process.env.DATABASE_URL) {
  console.log("ensure-migrations: DATABASE_URL is not set; skipping database migrations.");
  process.exit(0);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function runPrisma(args) {
  console.log(`ensure-migrations: prisma ${args.join(" ")}`);
  execFileSync(prismaBin, args, { stdio: "inherit" });
}

async function hasUsersTable() {
  const { rows } = await pool.query("SELECT to_regclass('public.users') IS NOT NULL AS ok");
  return rows[0].ok;
}

async function isMigrationRecorded() {
  const { rows } = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '0001_init') AS ok",
  );
  return rows[0].ok;
}

async function main() {
  if (!(await hasUsersTable())) {
    console.log("ensure-migrations: empty schema, applying migrations from scratch");
    await runPrisma(["migrate", "deploy"]);
    return;
  }

  let recorded = false;
  try {
    recorded = await isMigrationRecorded();
  } catch {
    recorded = false;
  }

  if (!recorded) {
    console.log(
      "ensure-migrations: existing schema without migration history — baselining 0001_init",
    );
    await runPrisma(["migrate", "resolve", "--applied", "0001_init"]);
  }

  await runPrisma(["migrate", "deploy"]);
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error("ensure-migrations failed:", error);
    pool.end();
    process.exit(1);
  });
