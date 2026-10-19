import { describe, expect, it, vi } from 'vitest';
import { parse } from 'pg-connection-string';
import { poolConnectionConfig } from './database.js';

const BASE = 'postgresql://sample_user:sample_pass@db.example.com/sample_db';

describe('poolConnectionConfig', () => {
  it.each(['require', 'prefer', 'verify-ca', 'REQUIRE'])('rewrites sslmode=%s to verify-full', (mode) => {
    const config = poolConnectionConfig(`${BASE}?sslmode=${mode}&channel_binding=require`, { isProduction: true });

    const url = new URL(config.connectionString);
    expect(url.searchParams.get('sslmode')).toBe('verify-full');
    expect(url.searchParams.get('channel_binding')).toBe('require');
    expect(url.username).toBe('sample_user');
    expect(url.password).toBe('sample_pass');
    expect(config).not.toHaveProperty('ssl');
  });

  it.each(['verify-full', 'disable', 'no-verify'])('keeps an explicit sslmode=%s', (mode) => {
    const config = poolConnectionConfig(`${BASE}?sslmode=${mode}`, { isProduction: true });

    expect(new URL(config.connectionString).searchParams.get('sslmode')).toBe(mode);
  });

  it('uses verified TLS in production when the URL has no sslmode', () => {
    expect(poolConnectionConfig(BASE, { isProduction: true })).toEqual({ connectionString: BASE, ssl: true });
  });

  it('leaves SSL to the defaults in development when the URL has no sslmode', () => {
    expect(poolConnectionConfig(BASE, { isProduction: false })).toEqual({ connectionString: BASE, ssl: undefined });
  });

  it('produces a URL pg parses without the deprecated sslmode warning', () => {
    const emitWarning = vi.spyOn(process, 'emitWarning');

    const parsed = parse(poolConnectionConfig(`${BASE}?sslmode=require`, { isProduction: true }).connectionString);

    expect(parsed.sslmode).toBe('verify-full');
    expect(parsed.ssl).toEqual({});
    expect(emitWarning).not.toHaveBeenCalled();
    emitWarning.mockRestore();
  });
});
