import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/errors.js";
import { prisma } from "../../shared/prisma.js";
import {
  authenticateRequest,
  createSession,
  csrfCookieName,
  hashToken,
  registerUser,
  sessionCookieName,
  verifyCredentials,
} from "./auth.service.js";

const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(10).max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
});
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 UTF-8 bytes"),
});
const cookieOptions = { sameSite: "lax" as const, secure: env.COOKIE_SECURE, path: "/" };

export const csrf = (req: Request, res: Response) => {
  const existing: unknown = req.cookies?.[csrfCookieName];
  const token = typeof existing === "string" && existing.length >= 32
    ? existing
    : randomBytes(32).toString("base64url");
  res.cookie(csrfCookieName, token, { ...cookieOptions, httpOnly: false });
  res.json({ data: { csrfToken: token } });
};

export function assertCsrf(req: Request): void {
  const cookie: unknown = req.cookies?.[csrfCookieName];
  const header = req.get("X-CSRF-Token");
  if (typeof cookie !== "string" || typeof header !== "string" || cookie !== header) {
    throw new HttpError(403, "CSRF_VALIDATION_FAILED", "Refresh the page and try again");
  }
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(sessionCookieName, token, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export const register = asyncHandler(async (req, res) => {
  assertCsrf(req);
  const input = registerSchema.parse(req.body);
  const user = await registerUser(input);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  assertCsrf(req);
  const input = loginSchema.parse(req.body);
  const user = await verifyCredentials(input.email, input.password);
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ data: { user } });
});

export const logout = asyncHandler(async (req, res) => {
  assertCsrf(req);
  const token: unknown = req.cookies?.[sessionCookieName];
  if (typeof token === "string") {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  res.clearCookie(sessionCookieName, { ...cookieOptions, httpOnly: true });
  res.status(204).end();
});

export const me = asyncHandler(async (req, res) => {
  const userId = await authenticateRequest(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Your account is unavailable");
  res.json({ data: { user } });
});
