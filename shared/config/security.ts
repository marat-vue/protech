const DEVELOPMENT_SCRIPT_SOURCE = "'unsafe-eval'";

export function createSecurityHeaders(isProduction: boolean): Record<string, string> {
  const scriptSources = ["'self'", "'unsafe-inline'"];

  if (!isProduction) {
    scriptSources.push(DEVELOPMENT_SCRIPT_SOURCE);
  }

  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' ws: wss: https://nominatim.openstreetmap.org",
    "frame-src 'self' https://www.openstreetmap.org",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isProduction ? ["upgrade-insecure-requests"] : [])
  ].join("; ");

  return {
    "content-security-policy": contentSecurityPolicy,
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "x-dns-prefetch-control": "on",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    ...(isProduction
      ? { "strict-transport-security": "max-age=31536000; includeSubDomains" }
      : {}),
    "x-content-type-options": "nosniff",
    "x-download-options": "noopen",
    "x-frame-options": "DENY"
  };
}
