import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let _pool: Pool | null = null;
let _prismaClient: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  if (!_prismaClient) {
    const isSsl = dbUrl.includes("sslmode=require") || dbUrl.includes("neon.tech");
    _pool = new Pool({
      connectionString: dbUrl,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 1, // 1 connection per serverless function instance
      min: 0, // release immediately when idle
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    const adapter = new PrismaPg(_pool);
    _prismaClient = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  return _prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

