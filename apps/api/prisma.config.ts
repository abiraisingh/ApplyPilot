import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: resolve(process.cwd(), "../../.env") });

const schema = process.env.PRISMA_SCHEMA ?? "prisma/schema.prisma";

export default defineConfig({
  schema,
  migrations: {
    path: schema.endsWith("schema.postgresql.prisma")
      ? "prisma/migrations-postgresql"
      : "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
