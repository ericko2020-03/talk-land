// path: lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgPool__: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL in .env");
}

// Reuse pool across HMR in dev
const pool =
  globalThis.__pgPool__ ??
  new Pool({
    connectionString,
    // 不在這裡硬寫 ssl，交給 DATABASE_URL 的 sslmode 決定
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool__ = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalThis.__prisma__ ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}