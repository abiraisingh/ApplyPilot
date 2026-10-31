import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ApplicationStatus } from "../../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../shared/errors.js";
import { prisma } from "../../shared/prisma.js";

const gmailApi = "https://gmail.googleapis.com/gmail/v1";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleAuthorizeEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const allowedPortalDomains = ["naukri.com", "linkedin.com", "internshala.com"];

type GmailMessage = {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
  snippet?: string;
};

type JobDetails = { companyName: string; role: string };

export function gmailApiFailureMessage(status: number, reason?: string): string {
  if (status === 403 && (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED")) {
    return "Gmail API is not enabled for the Google Cloud project used by ApplyPilot's OAuth client. Enable Gmail API in that project, then retry.";
  }
  if (status === 403 && (reason === "insufficientPermissions" || reason === "PERMISSION_DENIED")) {
    return "Google did not grant Gmail read-only permission. Disconnect Gmail, reconnect it, and approve the requested access.";
  }
  if (status === 403) {
    return `Google denied Gmail API access${reason ? ` (${reason})` : ""}. Check Gmail API enablement, OAuth test-user access, and the granted Gmail read-only scope.`;
  }
  if (status === 429) {
    return "Google is temporarily rate-limiting Gmail requests. Wait a few minutes, then retry.";
  }
  return `Google's Gmail API returned an error (HTTP ${status}${reason ? `, ${reason}` : ""}).`;
}

function googleErrorDetails(payload: unknown): { reason?: string } {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return {};
  const error = payload.error;
  if (typeof error !== "object" || error === null) return {};
  if (!("errors" in error) || !Array.isArray(error.errors)) return {};
  const firstError: unknown = error.errors[0];
  if (typeof firstError !== "object" || firstError === null || !("reason" in firstError)) return {};
  return typeof firstError.reason === "string" ? { reason: firstError.reason } : {};
}

function assertOAuthConfigured(): void {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new HttpError(503, "GMAIL_NOT_CONFIGURED", "Gmail sync is not configured by the administrator");
  }
}

function encryptionKey(): Buffer {
  const key = Buffer.from(env.OAUTH_TOKEN_ENCRYPTION_KEY, "base64");
  if (!env.OAUTH_TOKEN_ENCRYPTION_KEY || key.length !== 32) {
    throw new HttpError(503, "GMAIL_NOT_CONFIGURED", "Gmail sync encryption is not configured by the administrator");
  }
  return key;
}

function encryptRefreshToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptRefreshToken(value: string): string {
  const [iv, authTag, encrypted] = value.split(".");
  if (!iv || !authTag || !encrypted) {
    throw new HttpError(500, "GMAIL_TOKEN_INVALID", "The saved Gmail connection is invalid; reconnect Gmail");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(authTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new HttpError(500, "GMAIL_TOKEN_INVALID", "The saved Gmail connection cannot be decrypted; reconnect Gmail");
  }
}

function oauthStateHash(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

export async function createGmailAuthorizationUrl(userId: string): Promise<string> {
  assertOAuthConfigured();
  encryptionKey();
  const state = randomBytes(32).toString("base64url");
  await prisma.emailOAuthState.create({
    data: {
      stateHash: oauthStateHash(state),
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const url = new URL(googleAuthorizeEndpoint);
  url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_OAUTH_REDIRECT_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/gmail.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeAuthorizationCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
}> {
  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new HttpError(502, "GMAIL_OAUTH_FAILED", "Google could not complete the Gmail authorization");
  }
  const tokens = await response.json() as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token) {
    throw new HttpError(502, "GMAIL_OAUTH_FAILED", "Google did not return an access token");
  }
  return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
}

async function googleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) {
    throw new HttpError(401, "GMAIL_ACCESS_DENIED", "Gmail authorization expired; reconnect Gmail");
  }
  if (!response.ok) {
    const responseBody = await response.text();
    let payload: unknown = null;
    if (responseBody) {
      try {
        payload = JSON.parse(responseBody);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    const { reason } = googleErrorDetails(payload);
    throw new HttpError(502, "GMAIL_API_FAILED", gmailApiFailureMessage(response.status, reason));
  }
  return await response.json() as T;
}

export async function completeGmailAuthorization(state: string, code: string, userId: string): Promise<void> {
  assertOAuthConfigured();
  encryptionKey();
  const stateHash = oauthStateHash(state);
  const record = await prisma.emailOAuthState.findUnique({ where: { stateHash } });
  if (!record) throw new HttpError(400, "GMAIL_OAUTH_STATE_INVALID", "Gmail authorization expired; try connecting again");
  if (record.userId !== userId) {
    throw new HttpError(403, "GMAIL_OAUTH_USER_MISMATCH", "Sign in to the account that started Gmail authorization");
  }
  await prisma.emailOAuthState.delete({ where: { id: record.id } });
  if (record.expiresAt <= new Date()) {
    throw new HttpError(400, "GMAIL_OAUTH_STATE_EXPIRED", "Gmail authorization expired; try connecting again");
  }

  const tokens = await exchangeAuthorizationCode(code);
  const profile = await googleJson<{ email?: string }>(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    tokens.access_token,
  );
  if (!profile.email) throw new HttpError(502, "GMAIL_PROFILE_FAILED", "Google did not return the Gmail address");

  const current = await prisma.emailIntegration.findUnique({ where: { userId: record.userId } });
  const refreshToken = tokens.refresh_token
    ? encryptRefreshToken(tokens.refresh_token)
    : current?.encryptedRefreshToken;
  if (!refreshToken) {
    throw new HttpError(502, "GMAIL_REFRESH_TOKEN_MISSING", "Google did not grant offline access; reconnect Gmail and approve access");
  }

  await prisma.emailIntegration.upsert({
    where: { userId: record.userId },
    create: {
      userId: record.userId,
      email: profile.email,
      encryptedRefreshToken: refreshToken,
    },
    update: { email: profile.email, encryptedRefreshToken: refreshToken },
  });
}

async function refreshAccessToken(encryptedRefreshToken: string): Promise<string> {
  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: decryptRefreshToken(encryptedRefreshToken),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new HttpError(401, "GMAIL_ACCESS_DENIED", "Gmail authorization expired; reconnect Gmail");
  }
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) {
    throw new HttpError(502, "GMAIL_TOKEN_REFRESH_FAILED", "Google did not return a refreshed Gmail token");
  }
  return result.access_token;
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function textParts(payload: GmailMessage["payload"]): string[] {
  if (!payload) return [];
  const parts: string[] = [];
  if (payload.body?.data) {
    parts.push(Buffer.from(payload.body.data, "base64url").toString("utf8"));
  }
  for (const child of payload.parts ?? []) parts.push(...textParts(child));
  return parts;
}

function cleanEmailText(value: string): string {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30_000);
}

function portalForSender(from: string): string | null {
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const domain = address.trim().toLowerCase().split("@").at(-1)?.replace(/[>\s].*$/, "");
  if (!domain) return null;
  if (allowedPortalDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))) {
    return domain.split(".").slice(-2, -1)[0] ?? null;
  }
  return null;
}

export function statusFromPortalEmail(subject: string, body: string): ApplicationStatus | null {
  const content = `${subject} ${body}`.toLowerCase();
  if (/\b(job offer|offer letter|offering you the position|pleased to offer)\b/.test(content)) return "OFFER";
  if (/\b(interview|technical round|recruiter screen|schedule (?:a )?call)\b/.test(content)) return "INTERVIEW";
  if (/\b(assessment|coding challenge|take[ -]?home assignment|online test)\b/.test(content)) return "ASSESSMENT";
  if (/\b(regret to inform|not moving forward|not selected|application (?:was )?rejected)\b/.test(content)) return "REJECTED";
  if (/\b(application (?:has been )?(?:successfully )?submitted|application received|we received your application|you applied to|applied successfully)\b/.test(content)) return "APPLIED";
  return null;
}

export function jobDetailsFromPortalEmail(subject: string, body: string): JobDetails | null {
  const content = cleanEmailText(`${subject}. ${body}`);
  const patterns = [
    /(?:application(?:\s+submitted)?|applied)\s+(?:for|to)\s+["“]?(.+?)["”]?\s+(?:role\s+)?(?:at|with)\s+["“]?(.+?)["”]?(?:[.!|,;]|$)/i,
    /(?:you applied to)\s+["“]?(.+?)["”]?\s+at\s+["“]?(.+?)["”]?(?:[.!|,;]|$)/i,
    /(?:for the)\s+["“]?(.+?)["”]?\s+(?:position|role)\s+at\s+["“]?(.+?)["”]?(?:[.!|,;]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    const role = match?.[1]?.trim().replace(/\s+/g, " ");
    const companyName = match?.[2]?.trim().replace(/\s+/g, " ");
    if (role && companyName && role.length <= 160 && companyName.length <= 120) {
      return { role, companyName };
    }
  }
  const labeledRole = content.match(/(?:job title|role)\s*:\s*([^.;]{2,160})/i)?.[1]?.trim();
  const labeledCompany = content.match(/(?:company|employer)\s*:\s*([^.;]{2,120})/i)?.[1]?.trim();
  return labeledRole && labeledCompany
    ? { role: labeledRole, companyName: labeledCompany }
    : null;
}

async function readGmailMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const url = `${gmailApi}/users/me/messages/${encodeURIComponent(id)}?format=full`;
  return googleJson<GmailMessage>(url, accessToken);
}

async function listGmailMessages(accessToken: string): Promise<{ id: string }[]> {
  const query = encodeURIComponent(
    `newer_than:${env.GMAIL_LOOKBACK_DAYS}d {from:naukri.com from:linkedin.com from:internshala.com}`,
  );
  const url = `${gmailApi}/users/me/messages?maxResults=100&q=${query}`;
  const result = await googleJson<{ messages?: { id: string }[] }>(url, accessToken);
  return result.messages ?? [];
}

function sameJob(
  application: { companyName: string; role: string },
  details: JobDetails,
): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const existingCompany = normalize(application.companyName);
  const incomingCompany = normalize(details.companyName);
  const existingRole = normalize(application.role);
  const incomingRole = normalize(details.role);
  return (existingCompany === incomingCompany || existingCompany.includes(incomingCompany) || incomingCompany.includes(existingCompany)) &&
    (existingRole === incomingRole || existingRole.includes(incomingRole) || incomingRole.includes(existingRole));
}

async function importPortalMessage(userId: string, message: GmailMessage): Promise<string> {
  const from = header(message, "from");
  const portal = portalForSender(from);
  const subject = header(message, "subject");
  const body = cleanEmailText(textParts(message.payload).join(" ") || message.snippet || "");
  const status = portal ? statusFromPortalEmail(subject, body) : null;
  if (!portal || !status) return "ignored";

  const details = jobDetailsFromPortalEmail(subject, body);
  if (!details) return "needs_review";
  const applications = await prisma.application.findMany({
    where: { userId },
    select: { id: true, companyName: true, role: true, status: true },
  });
  const matchingApplications = applications.filter((application) => sameJob(application, details));
  if (matchingApplications.length > 1) return "needs_review";

  const existing = matchingApplications[0];
  if (!existing) {
    if (status !== "APPLIED") return "needs_review";
    await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          userId,
          companyName: details.companyName,
          role: details.role,
          status: "APPLIED",
          source: "GMAIL",
          appliedAt: new Date(),
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          toStatus: "APPLIED",
          note: `Application detected in ${portal} email`,
        },
      });
    });
    return "created";
  }

  if (existing.status === status) return "unchanged";
  await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: existing.id }, data: { status } });
    await tx.applicationEvent.create({
      data: {
        applicationId: existing.id,
        fromStatus: existing.status,
        toStatus: status,
        note: `Status detected in ${portal} email`,
      },
    });
  });
  return "updated";
}

export async function syncGmailIntegration(userId: string): Promise<{
  processed: number;
  created: number;
  updated: number;
  needsReview: number;
}> {
  const integration = await prisma.emailIntegration.findUnique({ where: { userId } });
  if (!integration) throw new HttpError(404, "GMAIL_NOT_CONNECTED", "Connect Gmail before syncing");
  const accessToken = await refreshAccessToken(integration.encryptedRefreshToken);
  const messages = await listGmailMessages(accessToken);
  const counts = { processed: 0, created: 0, updated: 0, needsReview: 0 };

  for (const { id } of messages) {
    const alreadyProcessed = await prisma.importedEmailMessage.findUnique({
      where: { integrationId_messageId: { integrationId: integration.id, messageId: id } },
      select: { id: true },
    });
    if (alreadyProcessed) continue;

    const message = await readGmailMessage(accessToken, id);
    const outcome = await importPortalMessage(userId, message);
    await prisma.importedEmailMessage.create({
      data: { integrationId: integration.id, messageId: id, outcome },
    });
    counts.processed += 1;
    if (outcome === "created") counts.created += 1;
    if (outcome === "updated") counts.updated += 1;
    if (outcome === "needs_review") counts.needsReview += 1;
  }

  await prisma.emailIntegration.update({
    where: { id: integration.id },
    data: { lastSyncedAt: new Date() },
  });
  return counts;
}

export async function revokeGmailIntegration(userId: string): Promise<void> {
  const integration = await prisma.emailIntegration.findUnique({ where: { userId } });
  if (!integration) return;
  const refreshToken = decryptRefreshToken(integration.encryptedRefreshToken);
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new HttpError(502, "GMAIL_DISCONNECT_FAILED", "Google could not revoke Gmail access; try again");
  }
  await prisma.emailIntegration.delete({ where: { id: integration.id } });
}

export async function listGmailIntegrations(): Promise<{ userId: string }[]> {
  return prisma.emailIntegration.findMany({ select: { userId: true } });
}

let scheduledSyncRunning = false;

export async function runScheduledGmailSync(): Promise<void> {
  if (scheduledSyncRunning) return;
  scheduledSyncRunning = true;
  try {
    const integrations = await listGmailIntegrations();
    for (const integration of integrations) {
      try {
        const result = await syncGmailIntegration(integration.userId);
        console.info("Gmail sync completed", { userId: integration.userId, ...result });
      } catch (error) {
        console.error("Gmail sync failed", { userId: integration.userId, error });
      }
    }
  } finally {
    scheduledSyncRunning = false;
  }
}
