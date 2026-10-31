import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../shared/errors.js";
import { prisma } from "../../shared/prisma.js";

export const sessionCookieName = "applypilot_session";
export const csrfCookieName = "applypilot_csrf";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return token;
}

export async function authenticateRequest(req: Request): Promise<string> {
  const token: unknown = req.cookies?.[sessionCookieName];
  if (typeof token !== "string" || token.length === 0) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");
  }
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.deleteMany({ where: { tokenHash } });
    throw new HttpError(401, "UNAUTHENTICATED", "Your session has expired");
  }
  return session.userId;
}

export async function registerUser(input: { email: string; name: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    return await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new HttpError(409, "EMAIL_IN_USE", "An account with this email already exists");
    }
    throw error;
  }
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
