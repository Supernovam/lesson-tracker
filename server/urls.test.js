import { describe, expect, it } from 'vitest';
import {
  assertFrontendCorsAllowList,
  assertHttpsUrl,
  googleRedirectUriFromApiBase,
  originFromUrl,
  resolveGoogleRedirectUri,
  withTrailingSlash,
} from './urls.js';

describe('withTrailingSlash', () => {
  it('adds a trailing slash for GitHub Pages paths', () => {
    expect(withTrailingSlash('https://supernovam.github.io/lesson-tracker')).toBe(
      'https://supernovam.github.io/lesson-tracker/'
    );
  });
});

describe('googleRedirectUriFromApiBase', () => {
  it('builds the callback on the public API origin', () => {
    expect(googleRedirectUriFromApiBase('https://api.example.onrender.com/')).toBe(
      'https://api.example.onrender.com/auth/google/callback'
    );
  });
});

describe('resolveGoogleRedirectUri', () => {
  it('prefers an explicit callback URL', () => {
    expect(
      resolveGoogleRedirectUri({
        explicit: 'https://api.example.onrender.com/auth/google/callback',
        renderExternalUrl: 'https://other.onrender.com',
        isProduction: true,
        defaultDev: 'http://localhost:5173/auth/google/callback',
      })
    ).toBe('https://api.example.onrender.com/auth/google/callback');
  });

  it('uses Render public URL in production when unset', () => {
    expect(
      resolveGoogleRedirectUri({
        explicit: '',
        renderExternalUrl: 'https://api.example.onrender.com',
        isProduction: true,
        defaultDev: 'http://localhost:5173/auth/google/callback',
      })
    ).toBe('https://api.example.onrender.com/auth/google/callback');
  });
});

describe('originFromUrl', () => {
  it('drops the GitHub Pages path', () => {
    expect(originFromUrl('https://supernovam.github.io/lesson-tracker/')).toBe(
      'https://supernovam.github.io'
    );
  });
});

describe('assertHttpsUrl', () => {
  it('rejects http in production checks', () => {
    expect(() => assertHttpsUrl('FRONTEND_URL', 'http://example.com')).toThrow(/https/);
  });
});

describe('assertFrontendCorsAllowList', () => {
  it('requires the Pages origin, not the full path', () => {
    expect(() =>
      assertFrontendCorsAllowList('https://supernovam.github.io/lesson-tracker/', [
        'https://wrong.example',
      ])
    ).toThrow(/CORS_ORIGINS/);
    expect(() =>
      assertFrontendCorsAllowList('https://supernovam.github.io/lesson-tracker/', [
        'https://supernovam.github.io',
      ])
    ).not.toThrow();
  });
});
