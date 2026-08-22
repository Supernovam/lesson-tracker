import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieSession from 'cookie-session';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import {
  buildGoogleAuthUrl,
  createPkcePair,
  exchangeGoogleCode,
  fetchGoogleUser,
  isEmailAllowed,
  parseEmailList,
  requireAuth,
  toSessionUser,
} from './auth.js';
import {
  assertFrontendCorsAllowList,
  assertHttpsUrl,
  resolveGoogleRedirectUri,
  withTrailingSlash,
} from './urls.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// pg returns bigint as string by default; Lesson.createdAt fits safely into JS number range.
types.setTypeParser(20, (val) => Number(val)); // 20 = int8

const app = express();
if (isProduction) app.set('trust proxy', 1);
app.use(express.json());

function parseCsv(value) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalEnv(name, fallback = '') {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

// GitHub Pages serves the frontend as a different origin than the API we deploy on Render.
// Without CORS headers, browsers will block fetch() requests.
//
// For production, set `CORS_ORIGINS` explicitly (comma-separated origins; scheme+host only).
// Example: https://supernovam.github.io,https://lesson-tracker-api.onrender.com
const defaultDevCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const corsOrigins = (() => {
  const envOrigins = parseCsv(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '');
  if (envOrigins.length > 0) return envOrigins;
  if (isProduction) return [];
  return defaultDevCorsOrigins;
})();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // No `Origin` header => not a browser CORS request.
  if (!origin) return next();

  if (!corsOrigins.includes(origin)) {
    return res.status(403).send('CORS origin not allowed');
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
if (!Number.isFinite(PORT)) throw new Error('PORT must be a number');
const DATABASE_URL = requiredEnv('DATABASE_URL');
const SESSION_SECRET = requiredEnv('SESSION_SECRET');
const GOOGLE_CLIENT_ID = optionalEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = optionalEnv('GOOGLE_CLIENT_SECRET');
const ALLOWED_EMAILS = parseEmailList(process.env.ALLOWED_EMAILS ?? '');
const googleOAuthReady = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (isProduction) {
  if (!GOOGLE_CLIENT_ID) throw new Error('Missing required env var: GOOGLE_CLIENT_ID');
  if (!GOOGLE_CLIENT_SECRET) throw new Error('Missing required env var: GOOGLE_CLIENT_SECRET');
  if (ALLOWED_EMAILS.length === 0) {
    throw new Error('ALLOWED_EMAILS must include at least one email');
  }
  if (SESSION_SECRET.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters in production');
  }
} else if (!googleOAuthReady) {
  console.warn(
    '[lesson-tracker] Google OAuth is incomplete: set GOOGLE_CLIENT_SECRET (and GOOGLE_CLIENT_ID) in .env to enable sign-in. The API will still start.'
  );
}

const defaultDevFrontendUrl = 'http://localhost:5173/lesson-tracker/';
const defaultDevRedirectUri = 'http://localhost:5173/auth/google/callback';
const FRONTEND_URL = withTrailingSlash(
  optionalEnv('FRONTEND_URL', isProduction ? '' : defaultDevFrontendUrl)
);
const GOOGLE_REDIRECT_URI = resolveGoogleRedirectUri({
  explicit: optionalEnv('GOOGLE_REDIRECT_URI'),
  renderExternalUrl: optionalEnv('RENDER_EXTERNAL_URL'),
  isProduction,
  defaultDev: defaultDevRedirectUri,
});

if (isProduction && !FRONTEND_URL) {
  throw new Error('Missing required env var: FRONTEND_URL');
}
if (isProduction && !GOOGLE_REDIRECT_URI) {
  throw new Error(
    'Missing GOOGLE_REDIRECT_URI (or RENDER_EXTERNAL_URL, which Render sets automatically)'
  );
}
if (isProduction) {
  assertHttpsUrl('FRONTEND_URL', FRONTEND_URL);
  assertHttpsUrl('GOOGLE_REDIRECT_URI', GOOGLE_REDIRECT_URI);
  if (corsOrigins.length === 0) {
    throw new Error(
      'Missing required env var: CORS_ORIGINS (include your GitHub Pages origin, e.g. https://supernovam.github.io)'
    );
  }
  assertFrontendCorsAllowList(FRONTEND_URL, corsOrigins);
}

function frontendRedirect(pathQuery) {
  const base = FRONTEND_URL.endsWith('/') ? FRONTEND_URL : `${FRONTEND_URL}/`;
  return new URL(pathQuery, base).toString();
}

app.use(
  cookieSession({
    name: 'lt.sid',
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    path: '/',
    // GitHub Pages and Render are different sites, so the API cookie must be
    // sent on cross-site fetch() from the SPA (credentials: 'include').
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  })
);

const databaseUrlWantsSsl = /sslmode=require/i.test(DATABASE_URL);
const shouldUseSsl = isProduction || databaseUrlWantsSsl;
const pgMax = process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : undefined;
const pgConnectionTimeoutMillis = process.env.PG_CONNECTION_TIMEOUT_MS
  ? Number(process.env.PG_CONNECTION_TIMEOUT_MS)
  : undefined;

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Neon requires SSL in production.
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  max: pgMax,
  connectionTimeoutMillis: pgConnectionTimeoutMillis,
});

let dbReady = false;
let dbInitError = null;

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id text PRIMARY KEY,
      student_name text NOT NULL,
      date date NOT NULL,
      duration integer NOT NULL CHECK (duration > 0),
      comment text NOT NULL DEFAULT '',
      created_at bigint NOT NULL
    );
  `);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSchemaWithRetries() {
  const maxAttempts = isProduction ? 8 : 4;
  const baseDelayMs = isProduction ? 250 : 150;
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Force an actual connection attempt early to fail fast and retry on transient Neon issues.
      await pool.query('SELECT 1');
      await ensureSchema();
      return;
    } catch (err) {
      lastErr = err;
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.error(
        `[lesson-tracker] DB init attempt ${attempt}/${maxAttempts} failed; retrying in ${delayMs}ms:`,
        err
      );
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }

  throw lastErr;
}

function startServer() {
  // Bind IPv4 explicitly so Render's health checker can reach the process.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[lesson-tracker] API listening on 0.0.0.0:${PORT}${dbReady ? '' : ' (db not ready yet)'}`
    );
  });
}

process.on('SIGTERM', async () => {
  console.log('[lesson-tracker] SIGTERM received; shutting down...');
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  console.log('[lesson-tracker] SIGINT received; shutting down...');
  try {
    await pool.end();
  } finally {
    process.exit(0);
  }
});

if (isProduction) {
  console.log(
    `[lesson-tracker] OAuth callback ${GOOGLE_REDIRECT_URI}; frontend ${FRONTEND_URL}; CORS ${corsOrigins.join(',')}`
  );
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'lesson-tracker-api' });
});

app.get('/api/health', (_req, res) => {
  // Always 200 so Render liveness checks pass even while DB is still connecting.
  // Lesson routes still return 503 when !dbReady.
  res.status(200).json({
    ok: true,
    dbReady,
    ...(dbInitError
      ? { error: String(dbInitError.message || dbInitError) }
      : {}),
  });
});

function googleOAuthUnavailable(res) {
  return res.status(503).type('html').send(`
    <!doctype html>
    <meta charset="utf-8" />
    <title>Google sign-in is not configured</title>
    <p>Set <code>GOOGLE_CLIENT_SECRET</code> (and <code>GOOGLE_CLIENT_ID</code>) in <code>.env</code>, then restart the API.</p>
    <p>Create a Web application OAuth client in Google Cloud Console and paste the client secret. Local redirect URI: <code>http://localhost:5173/auth/google/callback</code>.</p>
  `);
}

app.get('/auth/google', (req, res) => {
  if (!googleOAuthReady) return googleOAuthUnavailable(res);

  const state = crypto.randomBytes(24).toString('hex');
  const { verifier, challenge } = createPkcePair();
  req.session.oauth = { state, verifier };

  const url = buildGoogleAuthUrl({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    state,
    codeChallenge: challenge,
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  if (!googleOAuthReady) return googleOAuthUnavailable(res);

  const oauth = req.session?.oauth;
  req.session.oauth = undefined;

  const errorParam = typeof req.query.error === 'string' ? req.query.error : '';
  if (errorParam) {
    return res.redirect(frontendRedirect('?auth=error'));
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !oauth?.state || !oauth?.verifier || state !== oauth.state) {
    return res.redirect(frontendRedirect('?auth=error'));
  }

  try {
    const tokens = await exchangeGoogleCode({
      code,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: GOOGLE_REDIRECT_URI,
      codeVerifier: oauth.verifier,
    });
    const profile = await fetchGoogleUser(tokens.access_token);
    const user = toSessionUser(profile);

    if (!user.email || !user.emailVerified || !isEmailAllowed(user.email, ALLOWED_EMAILS)) {
      req.session.user = undefined;
      return res.redirect(frontendRedirect('?auth=denied'));
    }

    req.session.user = {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    return res.redirect(303, FRONTEND_URL);
  } catch (err) {
    console.error('[lesson-tracker] Google OAuth callback failed:', err);
    req.session.user = undefined;
    return res.redirect(frontendRedirect('?auth=error'));
  }
});

app.get('/auth/me', (req, res) => {
  const user = req.session?.user;
  if (!user?.email) return res.status(401).json({ error: 'unauthorized' });
  res.json({
    email: user.email,
    name: user.name || '',
    picture: user.picture || '',
  });
});

app.post('/auth/logout', (req, res) => {
  req.session = null;
  res.status(204).end();
});

app.get('/api/lessons', requireAuth, async (_req, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'db not ready' });
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        student_name AS "studentName",
        date::text AS date,
        duration,
        comment,
        created_at AS "createdAt"
      FROM lessons
      ORDER BY date ASC, created_at ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('[lesson-tracker] Failed to load lessons:', err);
    res.status(500).json({ ok: false, error: 'failed to load lessons' });
  }
});

app.post('/api/lessons', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'db not ready' });
  const body = req.body ?? {};
  const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  const duration = typeof body.duration === 'number' ? body.duration : Number(body.duration);
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

  const date = new Date(dateStr);
  const durationInt = Number.isInteger(duration) ? duration : Math.floor(duration);

  if (!studentName) return res.status(400).json({ error: 'studentName is required' });
  if (!dateStr || Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date is invalid' });
  if (!Number.isInteger(durationInt) || durationInt < 1 || durationInt > 9999) {
    return res
      .status(400)
      .json({ error: 'duration must be an integer between 1 and 9999' });
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO lessons (id, student_name, date, duration, comment, created_at)
        VALUES ($1, $2, $3::date, $4, $5, $6)
        RETURNING
          id,
          student_name AS "studentName",
          date::text AS date,
          duration,
          comment,
          created_at AS "createdAt"
      `,
      [id, studentName, dateStr, durationInt, comment, createdAt]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[lesson-tracker] Failed to create lesson:', err);
    res.status(500).json({ ok: false, error: 'failed to create lesson' });
  }
});

app.delete('/api/lessons/:id', requireAuth, async (req, res) => {
  if (!dbReady) return res.status(503).json({ ok: false, error: 'db not ready' });
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    await pool.query('DELETE FROM lessons WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error('[lesson-tracker] Failed to delete lesson:', err);
    res.status(500).json({ ok: false, error: 'failed to delete lesson' });
  }
});

// Accept traffic immediately so Render health checks can succeed while DB connects.
startServer();

ensureSchemaWithRetries()
  .then(() => {
    dbReady = true;
    console.log('[lesson-tracker] DB ready');
  })
  .catch((err) => {
    dbInitError = err;
    console.error('[lesson-tracker] DB init failed; API will still serve non-DB routes:', err);
  });
