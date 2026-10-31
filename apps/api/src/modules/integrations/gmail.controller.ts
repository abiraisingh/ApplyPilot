import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/errors.js";
import { prisma } from "../../shared/prisma.js";
import { assertCsrf } from "../auth/auth.controller.js";
import {
  completeGmailAuthorization,
  createGmailAuthorizationUrl,
  revokeGmailIntegration,
  syncGmailIntegration,
} from "./gmail.service.js";

function userIdOf(req: Request): string {
  if (!req.userId) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue");
  return req.userId;
}

export const connectGmail = asyncHandler(async (req, res) => {
  assertCsrf(req);
  const authorizationUrl = await createGmailAuthorizationUrl(userIdOf(req));
  res.json({ data: { authorizationUrl } });
});

export const gmailCallback = asyncHandler(async (req, res) => {
  const query = z.object({
    state: z.string().min(1),
    code: z.string().min(1).optional(),
    error: z.string().optional(),
  }).parse(req.query);
  if (query.error) {
    throw new HttpError(400, "GMAIL_CONSENT_DENIED", "Gmail access was not approved");
  }
  if (!query.code) {
    throw new HttpError(400, "GMAIL_OAUTH_FAILED", "Google did not return an authorization code");
  }
  await completeGmailAuthorization(query.state, query.code, userIdOf(req));
  res.redirect(`${env.WEB_ORIGIN}/?gmail=connected`);
});

export const gmailStatus = asyncHandler(async (req, res) => {
  const integration = await prisma.emailIntegration.findUnique({
    where: { userId: userIdOf(req) },
    select: { email: true, lastSyncedAt: true, createdAt: true },
  });
  res.json({ data: { connected: Boolean(integration), integration } });
});

export const syncGmail = asyncHandler(async (req, res) => {
  assertCsrf(req);
  const result = await syncGmailIntegration(userIdOf(req));
  res.json({ data: result });
});

export const disconnectGmail = asyncHandler(async (req, res) => {
  assertCsrf(req);
  await revokeGmailIntegration(userIdOf(req));
  res.status(204).end();
});
