// pg 8 treats these as aliases for verify-full and warns that pg 9 will weaken them to
// libpq semantics (encrypt without checking the certificate). Spelling out verify-full
// keeps today's behaviour and silences the warning.
const VERIFY_FULL_ALIASES = new Set(['prefer', 'require', 'verify-ca']);

/**
 * Pool options for `DATABASE_URL`. An `sslmode` in the URL wins (pg ignores the `ssl`
 * option when the URL sets one); without it, production still uses verified TLS.
 */
export function poolConnectionConfig(databaseUrl, { isProduction }) {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');

  if (sslmode) {
    if (VERIFY_FULL_ALIASES.has(sslmode.toLowerCase())) url.searchParams.set('sslmode', 'verify-full');
    return { connectionString: url.toString() };
  }
  return { connectionString: databaseUrl, ssl: isProduction ? true : undefined };
}
