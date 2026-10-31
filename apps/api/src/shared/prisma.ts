import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";

const adapter = env.DATABASE_URL.startsWith("postgres://") ||
    env.DATABASE_URL.startsWith("postgresql://")
  ? new PrismaPg({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
    })
  : new PrismaLibSql({
      url: pathToFileURL(
        isAbsolute(env.DATABASE_URL.slice("file:".length))
          ? env.DATABASE_URL.slice("file:".length)
          : resolve(process.cwd(), env.DATABASE_URL.slice("file:".length)),
      ).href,
    });

export const prisma = new PrismaClient({ adapter });
