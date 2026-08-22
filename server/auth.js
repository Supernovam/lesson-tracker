import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function parseEmailList(value) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email, allowedEmails) {
  if (typeof email !== 'string') return false;
  return allowedEmails.includes(email.trim().toLowerCase());
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildGoogleAuthUrl({ clientId, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  codeVerifier,
}) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function fetchGoogleUser(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google userinfo failed: ${res.status} ${text}`);
  }

  return res.json();
}

export function toSessionUser(profile) {
  const email = typeof profile.email === 'string' ? profile.email.trim() : '';
  const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const picture = typeof profile.picture === 'string' ? profile.picture.trim() : '';

  return { email, emailVerified, name, picture };
}

export function requireAuth(req, res, next) {
  const user = req.session?.user;
  if (!user?.email) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}
