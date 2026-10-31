import { describe, expect, it } from "vitest";
import {
  gmailApiFailureMessage,
  jobDetailsFromPortalEmail,
  statusFromPortalEmail,
} from "./gmail.service.js";

describe("Gmail API failure messages", () => {
  it("explains disabled API and missing Gmail scope errors", () => {
    expect(gmailApiFailureMessage(403, "accessNotConfigured"))
      .toContain("Enable Gmail API");
    expect(gmailApiFailureMessage(403, "insufficientPermissions"))
      .toContain("reconnect it");
  });

  it("reports other upstream status codes without exposing response content", () => {
    expect(gmailApiFailureMessage(429)).toContain("rate-limiting");
    expect(gmailApiFailureMessage(500)).toContain("HTTP 500");
  });
});

describe("Gmail job notification parsing", () => {
  it("classifies common application and interview updates", () => {
    expect(statusFromPortalEmail(
      "Application submitted for Product Designer at Northstar",
      "We received your application.",
    )).toBe("APPLIED");
    expect(statusFromPortalEmail(
      "Interview scheduled",
      "Your interview for Product Designer at Northstar is confirmed.",
    )).toBe("INTERVIEW");
    expect(statusFromPortalEmail(
      "An update on your application",
      "We regret to inform you that we are not moving forward.",
    )).toBe("REJECTED");
    expect(statusFromPortalEmail("Your profile was viewed", "A recruiter viewed your profile."))
      .toBeNull();
  });

  it("extracts a job only when the email identifies both the role and company", () => {
    expect(jobDetailsFromPortalEmail(
      "Application submitted for Product Designer at Northstar",
      "We received your application.",
    )).toEqual({ role: "Product Designer", companyName: "Northstar" });
    expect(jobDetailsFromPortalEmail("Interview scheduled", "Your interview is confirmed."))
      .toBeNull();
  });
});
