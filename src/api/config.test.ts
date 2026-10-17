import { describe, expect, it } from 'vitest';
import { errorFromResponse } from './config';

function response(body: string, status = 500, statusText = 'Internal Server Error') {
  return new Response(body, { status, statusText });
}

describe('errorFromResponse', () => {
  it('uses the API error message when the body is JSON with an error', async () => {
    const err = await errorFromResponse(response(JSON.stringify({ error: 'name already exists' }), 409, 'Conflict'));
    expect(err.message).toBe('name already exists');
  });

  it('prefers the context over a non-JSON body such as an HTML error page', async () => {
    const err = await errorFromResponse(response('<!DOCTYPE html><p>Bad gateway</p>', 502, 'Bad Gateway'), 'Failed to issue invoices');
    expect(err.message).toBe('Failed to issue invoices: 502 Bad Gateway');
  });

  it('falls back to the raw body, then the status, without a context', async () => {
    expect((await errorFromResponse(response('plain failure'))).message).toBe('plain failure');
    expect((await errorFromResponse(response(''))).message).toBe('500 Internal Server Error');
  });
});
