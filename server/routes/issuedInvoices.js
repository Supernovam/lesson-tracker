import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../auth.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ISSUED_INVOICE_RETURNING = `
  school_id AS "schoolId",
  period_from::text AS "from",
  period_to::text AS "to",
  year,
  number,
  issued_on::text AS "issuedOn"
`;

function isForeignKeyViolation(err) {
  return Boolean(err && err.code === '23503');
}

function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value);
}

function parsePeriod(source) {
  const { from, to } = source;
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: 'from and to must be YYYY-MM-DD dates' };
  if (from > to) return { error: 'from cannot be after to' };
  return { from, to };
}

function parseIssueBody(body) {
  const period = parsePeriod(body);
  if (period.error) return period;
  if (!isIsoDate(body.issuedOn)) return { error: 'issuedOn must be a YYYY-MM-DD date' };

  const { schoolIds } = body;
  if (
    !Array.isArray(schoolIds) ||
    schoolIds.length === 0 ||
    schoolIds.some((id) => typeof id !== 'string' || !id)
  ) {
    return { error: 'schoolIds must be a non-empty list of school ids' };
  }
  if (new Set(schoolIds).size !== schoolIds.length) return { error: 'schoolIds must be unique' };

  return { ...period, issuedOn: body.issuedOn, year: Number(body.issuedOn.slice(0, 4)), schoolIds };
}

/**
 * First Rechnungsnummer per invoice year when the app takes over numbering mid-year
 * (earlier numbers were issued outside the app). Years not listed start at 1.
 */
export const FIRST_INVOICE_NUMBER_BY_YEAR = { 2026: 12 };

async function nextNumberForYear(db, year) {
  const { rows } = await db.query(
    'SELECT COALESCE(MAX(number), 0) + 1 AS "nextNumber" FROM issued_invoices WHERE year = $1',
    [year]
  );
  return Math.max(Number(rows[0]?.nextNumber ?? 1), FIRST_INVOICE_NUMBER_BY_YEAR[year] ?? 1);
}

export function createIssuedInvoicesRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);

  // Issued numbers for one billing period, plus the number the next issue in `year` would get.
  router.get('/', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).json({ error: period.error });
    const year = Number(req.query.year);
    if (!Number.isInteger(year)) return res.status(400).json({ error: 'year is required' });

    try {
      const { rows } = await pool.query(
        `
          SELECT ${ISSUED_INVOICE_RETURNING}
          FROM issued_invoices
          WHERE period_from = $1 AND period_to = $2
          ORDER BY year ASC, number ASC
        `,
        [period.from, period.to]
      );
      const nextNumber = await nextNumberForYear(pool, year);
      res.json({ invoices: rows, nextNumber });
    } catch (err) {
      console.error('[lesson-tracker] Failed to load issued invoices:', err);
      res.status(500).json({ ok: false, error: 'failed to load issued invoices' });
    }
  });

  // Assigns consecutive numbers in `schoolIds` order. Schools already issued for this
  // period keep their number. The table lock serialises concurrent Issue clicks.
  router.post('/', async (req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    const parsed = parseIssueBody(req.body ?? {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE issued_invoices IN SHARE ROW EXCLUSIVE MODE');

      const { rows: existing } = await client.query(
        `
          SELECT school_id AS "schoolId"
          FROM issued_invoices
          WHERE period_from = $1 AND period_to = $2 AND school_id = ANY($3)
        `,
        [parsed.from, parsed.to, parsed.schoolIds]
      );
      const alreadyIssued = new Set(existing.map((row) => row.schoolId));

      let number = await nextNumberForYear(client, parsed.year);
      const now = Date.now();
      for (const schoolId of parsed.schoolIds) {
        if (alreadyIssued.has(schoolId)) continue;
        await client.query(
          `
            INSERT INTO issued_invoices
              (id, school_id, period_from, period_to, year, number, issued_on, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [crypto.randomUUID(), schoolId, parsed.from, parsed.to, parsed.year, number, parsed.issuedOn, now]
        );
        number += 1;
      }

      const { rows } = await client.query(
        `
          SELECT ${ISSUED_INVOICE_RETURNING}
          FROM issued_invoices
          WHERE period_from = $1 AND period_to = $2 AND school_id = ANY($3)
          ORDER BY year ASC, number ASC
        `,
        [parsed.from, parsed.to, parsed.schoolIds]
      );
      await client.query('COMMIT');
      res.status(201).json(rows);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (isForeignKeyViolation(err)) {
        return res.status(400).json({ error: 'Unknown school' });
      }
      console.error('[lesson-tracker] Failed to issue invoices:', err);
      res.status(500).json({ ok: false, error: 'failed to issue invoices' });
    } finally {
      client.release();
    }
  });

  return router;
}
