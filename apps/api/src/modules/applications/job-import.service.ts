import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { HttpError } from "../../shared/errors.js";

const maxPageBytes = 1_000_000;
const maxRedirects = 3;
const requestTimeoutMs = 8_000;

type JobDetails = {
  companyName: string | null;
  role: string | null;
  location: string | null;
  jobDescription: string | null;
};

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [first, second, third] = octets;
    if (first === undefined || second === undefined || third === undefined) return false;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second! >= 64 && second! <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second! >= 16 && second! <= 31) ||
      (first === 192 && second === 0 && (third === 0 || third === 2)) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 88 && third === 99) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113) ||
      first >= 224
    );
  }

  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  const firstHextet = Number.parseInt(normalized.split(":")[0] ?? "", 16);
  return firstHextet >= 0x2000 &&
    firstHextet <= 0x3fff &&
    !normalized.startsWith("2001:db8:") &&
    !normalized.startsWith("2002:");
}

function validateUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, "INVALID_JOB_URL", "Enter a valid public job posting URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !url.hostname ||
    isIP(url.hostname)
  ) {
    throw new HttpError(400, "INVALID_JOB_URL", "Use an HTTPS URL for a public job posting");
  }
  url.hash = "";
  return url;
}

function requestPage(url: URL, address: string, family: number): Promise<{
  statusCode: number;
  location: string | undefined;
  contentType: string;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: "GET",
      headers: {
        "User-Agent": "ApplyPilotJobImporter/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity",
      },
      servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (res) => {
      const statusCode = res.statusCode ?? 0;
      const location = res.headers.location;
      const contentType = res.headers["content-type"] ?? "";
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > maxPageBytes) {
          res.destroy(new Error("Job posting page is too large"));
          return;
        }
        chunks.push(buffer);
      });
      res.on("end", () => resolve({
        statusCode,
        location,
        contentType,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      res.on("error", reject);
    });

    req.setTimeout(requestTimeoutMs, () => req.destroy(new Error("Job posting request timed out")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchPage(value: string, redirects = 0): Promise<{ body: string; url: URL }> {
  const url = validateUrl(value);
  let addresses: LookupAddress[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new HttpError(422, "JOB_PAGE_UNAVAILABLE", "Could not resolve the job posting website");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new HttpError(400, "INVALID_JOB_URL", "Job posting URLs must resolve only to public IP addresses");
  }

  let response: Awaited<ReturnType<typeof requestPage>>;
  try {
    const address = addresses[0]!;
    response = await requestPage(url, address.address, address.family);
  } catch {
    throw new HttpError(422, "JOB_PAGE_UNAVAILABLE", "Could not fetch this job posting page");
  }

  if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
    if (redirects >= maxRedirects) {
      throw new HttpError(422, "JOB_PAGE_UNAVAILABLE", "The job posting has too many redirects");
    }
    let redirectedUrl: string;
    try {
      redirectedUrl = new URL(response.location, url).toString();
    } catch {
      throw new HttpError(422, "JOB_PAGE_UNAVAILABLE", "The job posting returned an invalid redirect");
    }
    return fetchPage(redirectedUrl, redirects + 1);
  }
  if (response.statusCode !== 200 || !response.contentType.toLowerCase().includes("html")) {
    throw new HttpError(422, "JOB_PAGE_UNAVAILABLE", "This website did not provide a readable job posting page");
  }
  return { body: response.body, url };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => decodeCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => decodeCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeCodePoint(code: number): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : "\uFFFD";
}

function attribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`, "i"));
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeHtml(value.trim()) : null;
}

function metaContent(html: string, ...keys: string[]): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    if (key && keys.includes(key.toLowerCase())) {
      return attribute(tag, "content");
    }
  }
  return null;
}

function plainText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const text = decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return text || null;
}

function isJobPosting(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as Record<string, unknown>)["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function findJobPosting(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 32) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findJobPosting(item, depth + 1);
      if (result) return result;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  if (isJobPosting(value)) return value;
  for (const child of Object.values(value)) {
    const result = findJobPosting(child, depth + 1);
    if (result) return result;
  }
  return null;
}

function jsonLdJob(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (attribute(match[0].slice(0, match[0].indexOf(">") + 1), "type")?.toLowerCase() !== "application/ld+json") {
      continue;
    }
    try {
      const result = findJobPosting(JSON.parse(match[1]!));
      if (result) return result;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return null;
}

function jobLocation(job: Record<string, unknown> | null): string | null {
  const locations = job?.jobLocation;
  const first = Array.isArray(locations) ? locations[0] : locations;
  if (!first || typeof first !== "object") return null;
  const address = (first as Record<string, unknown>).address;
  if (typeof address === "string") return plainText(address, 160);
  if (!address || typeof address !== "object") return null;
  const fields = address as Record<string, unknown>;
  const country = fields.addressCountry;
  const countryName = country && typeof country === "object"
    ? (country as Record<string, unknown>).name
    : country;
  return plainText([
    fields.addressLocality,
    fields.addressRegion,
    countryName,
  ].filter((part): part is string => typeof part === "string").join(", "), 160);
}

export function extractJobDetails(html: string): JobDetails {
  const job = jsonLdJob(html);
  const organization = job?.hiringOrganization;
  const companyName = organization && typeof organization === "object"
    ? (organization as Record<string, unknown>).name
    : organization;
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const description = typeof job?.description === "string"
    ? job.description
    : metaContent(html, "og:description", "description");

  return {
    companyName: plainText(typeof companyName === "string" ? companyName : null, 120),
    role: plainText(
      typeof job?.title === "string"
        ? job.title
        : metaContent(html, "og:title") ?? titleMatch?.[1],
      160,
    ),
    location: jobLocation(job),
    jobDescription: plainText(description, 20_000),
  };
}

export async function importJobDetails(value: string): Promise<JobDetails & { jobUrl: string }> {
  const { body, url } = await fetchPage(value);
  const details = extractJobDetails(body);
  if (!details.role && !details.companyName) {
    throw new HttpError(422, "JOB_DETAILS_NOT_FOUND", "This page did not expose recognizable job details; enter them manually");
  }
  return { ...details, jobUrl: url.toString() };
}
