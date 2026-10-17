import { Router } from 'express';
import { requireAuth } from '../auth.js';

const INVOICE_SETTINGS_RETURNING = `
  issuer_name AS "issuerName",
  issuer_street AS "issuerStreet",
  issuer_postal_code AS "issuerPostalCode",
  issuer_city AS "issuerCity",
  issuer_phone AS "issuerPhone",
  issuer_email AS "issuerEmail",
  issuer_tax_number AS "issuerTaxNumber",
  issuer_iban AS "issuerIban",
  issuer_bic AS "issuerBic"
`;

export function createInvoiceSettingsRouter({ pool, isDbReady }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (_req, res) => {
    if (!isDbReady()) return res.status(503).json({ ok: false, error: 'db not ready' });
    try {
      const { rows } = await pool.query(`
        SELECT ${INVOICE_SETTINGS_RETURNING}
        FROM invoice_settings
        WHERE id = 'default'
        LIMIT 1
      `);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'invoice settings not found' });
      }
      res.json(rows[0]);
    } catch (err) {
      console.error('[lesson-tracker] Failed to load invoice settings:', err);
      res.status(500).json({ ok: false, error: 'failed to load invoice settings' });
    }
  });

  return router;
}
