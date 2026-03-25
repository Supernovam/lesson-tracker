import express from 'express';
import { Pool, types } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// pg returns bigint as string by default; Lesson.createdAt fits safely into JS number range.
types.setTypeParser(20, (val) => Number(val)); // 20 = int8

const app = express();
app.use(express.json());

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const DATABASE_URL = requiredEnv('DATABASE_URL');

const pool = new Pool({
  connectionString: DATABASE_URL,
  // Neon requires SSL in production; enabling this is harmless for local connections that already work.
  ssl: { rejectUnauthorized: false },
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

ensureSchema()
  .then(() => {
    dbReady = true;
    app.listen(PORT, () => {
      console.log(`[lesson-tracker] API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    dbInitError = err;
    console.error('[lesson-tracker] DB init failed; API will still start:', err);
    app.listen(PORT, () => {
      console.log(`[lesson-tracker] API listening on http://localhost:${PORT} (db not ready yet)`);
    });
  });

