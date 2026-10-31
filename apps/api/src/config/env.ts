import { resolve } from "node:path";
import "dotenv/config";
import { config } from "dotenv";
import { z } from "zod";

config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1).default("file:./prisma/dev.db"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(""),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(""),
  GOOGLE_OAUTH_REDIRECT_URL: z.string().url().default("http://localhost:4000/api/v1/integrations/gmail/callback"),
  OAUTH_TOKEN_ENCRYPTION_KEY: z.string().default(""),
  GMAIL_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(365).default(60),
  GMAIL_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(60).default(10),
  AI_BASE_URL: z.union([z.literal(""), z.string().url()]).default(""),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().trim().min(1).default("gpt-4o-mini"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  COOKIE_SECURE: z.string().default("false").transform((value) => value === "true"),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production") {
    if (!value.DATABASE_URL.startsWith("postgres://") && !value.DATABASE_URL.startsWith("postgresql://")) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "Production requires a PostgreSQL DATABASE_URL" });
    }
    if (!value.COOKIE_SECURE) {
      context.addIssue({ code: "custom", path: ["COOKIE_SECURE"], message: "Secure cookies are required in production" });
    }
  }
  if (Boolean(value.AI_BASE_URL) !== Boolean(value.AI_API_KEY)) {
    context.addIssue({
      code: "custom",
      path: ["AI_API_KEY"],
      message: "AI_BASE_URL and AI_API_KEY must both be configured to enable AI features",
    });
  }
  if (value.AI_BASE_URL) {
    const aiUrl = new URL(value.AI_BASE_URL);
    if (!["http:", "https:"].includes(aiUrl.protocol) || aiUrl.username || aiUrl.password || aiUrl.search || aiUrl.hash) {
      context.addIssue({
        code: "custom",
        path: ["AI_BASE_URL"],
        message: "AI_BASE_URL must be an HTTP(S) base URL without credentials, query, or fragment",
      });
    }
    if (value.NODE_ENV === "production" && aiUrl.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["AI_BASE_URL"],
        message: "AI_BASE_URL must use HTTPS in production",
      });
    }
  }
});

export const env = envSchema.parse({
  ...process.env,
  API_PORT: process.env.PORT ?? process.env.API_PORT,
});
