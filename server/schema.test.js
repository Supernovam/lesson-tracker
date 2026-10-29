import { beforeAll, describe, expect, it } from 'vitest';
import { ensureSchema } from './schema.js';
import { createFakePool } from './routes/testHelpers.js';

describe('ensureSchema', () => {
  let pool;

  beforeAll(async () => {
    pool = createFakePool();
    await ensureSchema(pool);
  });

  function statementIndex(...fragments) {
    return pool.calls.findIndex((call) => fragments.every((fragment) => call.sql.includes(fragment)));
  }

  function statement(...fragments) {
    return pool.calls[statementIndex(...fragments)].sql;
  }

  it.each(['lesson_types', 'lessons'])('adds a duration unit to %s, defaulting to minutes', (table) => {
    const sql = statement(`ALTER TABLE ${table}\n`, 'duration_unit');

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'minutes'");
    expect(sql).toContain("CHECK (duration_unit IN ('minutes', 'teaching_units'))");
  });

  it('adds the lesson duration unit after both tables exist', () => {
    const index = statementIndex('ALTER TABLE lessons\n', 'duration_unit');

    expect(index).toBeGreaterThan(statementIndex('CREATE TABLE IF NOT EXISTS lessons'));
    expect(index).toBeGreaterThan(statementIndex('CREATE TABLE IF NOT EXISTS lesson_types'));
  });

  it('indexes lessons by lesson type', () => {
    expect(statement('CREATE INDEX')).toContain(
      'CREATE INDEX IF NOT EXISTS lessons_lesson_type_id_idx ON lessons (lesson_type_id)'
    );
  });

  it('widens lesson duration to numeric only while it is still an integer column', () => {
    const sql = statement('ALTER COLUMN duration TYPE');

    expect(sql).toContain('ALTER TABLE lessons ALTER COLUMN duration TYPE numeric(7, 2)');
    expect(sql).toMatch(/IF EXISTS \(\s*SELECT 1\s*FROM information_schema\.columns/);
    expect(sql).toContain('table_schema = current_schema()');
    expect(sql).toMatch(/table_name = 'lessons'\s+AND column_name = 'duration'\s+AND data_type = 'integer'/);
  });
});
