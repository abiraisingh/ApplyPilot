import { describe, expect, it } from "vitest";
import { HttpError } from "../../shared/errors.js";
import { extractJobDetails, importJobDetails, isPublicAddress } from "./job-import.service.js";

describe("job page import", () => {
  it("extracts employer, title, location, and description from JobPosting metadata", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer",
      "hiringOrganization":{"@type":"Organization","name":"Northstar"},
      "jobLocation":{"address":{"addressLocality":"Bengaluru","addressCountry":"India"}},
      "description":"Build <strong>great</strong> products."}
    </script></head></html>`;

    expect(extractJobDetails(html)).toEqual({
      companyName: "Northstar",
      role: "Software Engineer",
      location: "Bengaluru, India",
      jobDescription: "Build great products.",
    });
  });

  it("uses public page metadata when structured job data is unavailable", () => {
    const html = `<html><head>
      <meta property="og:title" content="Product Designer &amp; Researcher">
      <meta name="description" content="Join&#99999999; our design team">
    </head></html>`;

    expect(extractJobDetails(html)).toMatchObject({
      role: "Product Designer & Researcher",
      jobDescription: "Join\uFFFD our design team",
    });
  });

  it("rejects insecure or local URLs before making a request", async () => {
    await expect(importJobDetails("http://127.0.0.1/admin")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JOB_URL",
    } satisfies Partial<HttpError>);
  });

  it("allows public addresses and rejects private, reserved, and local addresses", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});
