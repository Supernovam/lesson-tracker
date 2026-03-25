import express from 'express';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// pg returns bigint as string by default; Lesson.createdAt fits safely into JS number range.
types.setTypeParser(20, (val) => Number(val)); // 20 = int8

const app = express();
app.use(express.json());

function parseCsv(value) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// GitHub Pages serves the frontend as a different origin than the API we deploy on Render.
// Without CORS headers, browsers will block fetch() requests.
//
// For production, set `CORS_ORIGINS` explicitly (comma-separated origins; scheme+host only).
// Example: https://supernovam.github.io,https://lesson-tracker-api.onrender.com
const corsAllowAll = (process.env.CORS_ALLOW_ALL ?? '').trim().toLowerCase() === 'true';
const defaultDevCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];
const corsOrigins = (() => {
  if (corsAllowAll) return ['*'];
  const envOrigins = parseCsv(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '');
  if (envOrigins.length > 0) return envOrigins;
  if (isProduction) return [];
  return defaultDevCorsOrigins;
})();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  // No `Origin` header => not a browser CORS request.
  if (!origin) return next();

  const originAllowed = corsOrigins.includes('*') || corsOrigins.includes(origin);
  if (!originAllowed) {
    if (req.method === 'OPTIONS') {
      return res.status(403).send('CORS origin not allowed');
    }
    return next();
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
if (!Number.isFinite(PORT)) throw new Error('PORT must be a number');
const DATABASE_URL = requiredEnv('DATABASE_URL');

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
  app.listen(PORT, () => {
    console.log(`[lesson-tracker] API listening on port ${PORT}${dbReady ? '' : ' (db not ready yet)'}`);
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

if (isProduction && !corsAllowAll && corsOrigins.length === 0) {
  console.warn(
    '[lesson-tracker] CORS_ORIGINS is not set; browser requests from GitHub Pages will be blocked in production.'
  );
}

app.get('/api/health', (_req, res) => {
  if (!dbReady) {
    res.status(503).json({
      ok: false,
      dbReady,
      error: dbInitError ? String(dbInitError.message || dbInitError) : 'db not ready',
    });
    return;
  }
  res.json({ ok: true, dbReady });
});

app.get('/api/lessons', async (_req, res) => {
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

app.post('/api/lessons', async (req, res) => {
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

app.delete('/api/lessons/:id', async (req, res) => {
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

ensureSchemaWithRetries()
  .then(() => {
    dbReady = true;
    startServer();
  })
  .catch((err) => {
    dbInitError = err;
    console.error('[lesson-tracker] DB init failed; API will still start:', err);
    startServer();
  });

