export function stripTrailingSlash(url) {
  return String(url).replace(/\/+$/, '');
}

export function withTrailingSlash(url) {
  const value = String(url).trim();
  if (!value) return value;
  return value.endsWith('/') ? value : `${value}/`;
}

export function originFromUrl(urlString) {
  return new URL(urlString).origin;
}

export function googleRedirectUriFromApiBase(apiBase) {
  const base = stripTrailingSlash(apiBase ?? '');
  if (!base) return '';
  return `${base}/auth/google/callback`;
}

export function resolveGoogleRedirectUri({
  explicit,
  renderExternalUrl,
  isProduction,
  defaultDev,
}) {
  if (explicit) return explicit;
  if (isProduction && renderExternalUrl) {
    return googleRedirectUriFromApiBase(renderExternalUrl);
  }
  if (!isProduction) return defaultDev;
  return '';
}

export function assertHttpsUrl(name, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use https in production`);
  }
  return parsed;
}

export function assertFrontendCorsAllowList(frontendUrl, corsOrigins) {
  const origin = originFromUrl(frontendUrl);
  if (!corsOrigins.includes(origin)) {
    throw new Error(
      `CORS_ORIGINS must include the FRONTEND_URL origin (${origin}) so the browser can send the session cookie`
    );
  }
}
