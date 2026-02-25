// path: lib/prisma.ts
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Why require() here?
 * - On Vercel, TypeScript type-check can run before Prisma Client is generated,
 *   causing errors like: "@prisma/client has no exported member PrismaClient".
 * - Using runtime require prevents TS from blocking the build.
 * - We still guarantee generation via package.json "postinstall": "prisma generate".
 */
const { PrismaClient } = require("@prisma/client") as { PrismaClient: new (args: any) => any };

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: any | undefined;
  // eslint-disable-next-line no-var
  var __pgPool__: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL in environment variables");
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