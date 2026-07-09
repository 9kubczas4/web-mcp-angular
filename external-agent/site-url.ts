/** Fallback when neither a tool url argument nor WEBMCP_URL is set. */
export const DEFAULT_SITE_URL = 'https://webmcp-angular-demo.web.app';

/** Normalizes a user- or env-provided URL (adds https when missing). */
export function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolves the target page URL.
 * Priority: explicit argument → WEBMCP_URL env → DEFAULT_SITE_URL.
 */
export function resolveSiteUrl(explicitUrl?: string): string {
  if (explicitUrl?.trim()) {
    return normalizeSiteUrl(explicitUrl);
  }

  const fromEnv = process.env['WEBMCP_URL']?.trim();
  if (fromEnv) {
    return normalizeSiteUrl(fromEnv);
  }

  return DEFAULT_SITE_URL;
}
