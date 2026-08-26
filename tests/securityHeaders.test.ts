import { describe, expect, it } from "vitest";
import { createSecurityHeaders } from "../shared/config/security";

describe("security headers", () => {
  it("locks down production documents and allows required external services", () => {
    const headers = createSecurityHeaders(true);
    const csp = headers["content-security-policy"];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://nominatim.openstreetmap.org");
    expect(csp).toContain("https://www.openstreetmap.org");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain(DEVELOPMENT_ONLY_SOURCE);
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-frame-options"]).toBe("DENY");
  });

  it("keeps local development compatible without advertising HSTS", () => {
    const headers = createSecurityHeaders(false);
    const csp = headers["content-security-policy"];

    expect(csp).toContain(DEVELOPMENT_ONLY_SOURCE);
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(headers).not.toHaveProperty("strict-transport-security");
  });
});

const DEVELOPMENT_ONLY_SOURCE = "'unsafe-eval'";
