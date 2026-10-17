export async function ensureSchema(pool) {
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_types (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      base_price numeric(10, 2) NOT NULL CHECK (base_price >= 0),
      base_duration_minutes integer NOT NULL CHECK (base_duration_minutes > 0),
      created_at bigint NOT NULL,
      updated_at bigint NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS lesson_type_id text REFERENCES lesson_types(id) ON DELETE RESTRICT
  `);
  await pool.query(`
    ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS calculated_price numeric(10, 2)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id text PRIMARY KEY,
      title text NOT NULL UNIQUE,
      billing_name text NOT NULL,
      address text NOT NULL,
      created_at bigint NOT NULL,
      updated_at bigint NOT NULL
    );
  `);
  await pool.query(`
    ALTER TABLE schools
      ADD COLUMN IF NOT EXISTS billing_name text
  `);
  await pool.query(`
    UPDATE schools
    SET billing_name = title
    WHERE billing_name IS NULL
  `);
  await pool.query(`
    ALTER TABLE schools
      ALTER COLUMN billing_name SET NOT NULL
  `);
  await pool.query(`
    ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS school_id text REFERENCES schools(id) ON DELETE RESTRICT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id text PRIMARY KEY,
      issuer_name text NOT NULL,
      issuer_street text NOT NULL,
      issuer_postal_code text NOT NULL,
      issuer_city text NOT NULL,
      issuer_phone text NOT NULL,
      issuer_email text NOT NULL,
      issuer_tax_number text NOT NULL,
      issuer_iban text NOT NULL,
      issuer_bic text NOT NULL,
      updated_at bigint NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS issued_invoices (
      id text PRIMARY KEY,
      school_id text NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
      period_from date NOT NULL,
      period_to date NOT NULL,
      year integer NOT NULL,
      number integer NOT NULL CHECK (number > 0),
      issued_on date NOT NULL,
      created_at bigint NOT NULL,
      UNIQUE (school_id, period_from, period_to),
      UNIQUE (year, number)
    );
  `);
}
