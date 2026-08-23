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
}
