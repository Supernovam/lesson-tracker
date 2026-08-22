import { describe, expect, it } from 'vitest';
import {
  buildGoogleAuthUrl,
  isEmailAllowed,
  parseEmailList,
  toSessionUser,
} from './auth.js';

describe('parseEmailList', () => {
  it('normalizes and de-spaces emails', () => {
    expect(parseEmailList(' Ada@Example.com, bob@example.com ')).toEqual([
      'ada@example.com',
      'bob@example.com',
    ]);
  });
});

describe('isEmailAllowed', () => {
  const allowed = parseEmailList('you@gmail.com, friend@gmail.com');

  it('matches case-insensitively', () => {
    expect(isEmailAllowed('You@Gmail.com', allowed)).toBe(true);
  });

  it('rejects unknown emails', () => {
    expect(isEmailAllowed('other@gmail.com', allowed)).toBe(false);
  });
});

describe('toSessionUser', () => {
  it('requires a verified email', () => {
    expect(
      toSessionUser({
        email: 'you@gmail.com',
        email_verified: true,
        name: 'You',
        picture: 'https://example.com/a.png',
      })
    ).toEqual({
      email: 'you@gmail.com',
      emailVerified: true,
      name: 'You',
      picture: 'https://example.com/a.png',
    });
  });
});

describe('buildGoogleAuthUrl', () => {
  it('includes PKCE and email scopes', () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: 'client-id',
        redirectUri: 'http://localhost:5173/auth/google/callback',
        state: 'abc',
        codeChallenge: 'challenge',
      })
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('email');
  });
});
