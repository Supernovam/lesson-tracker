import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('links to the Google OAuth start URL', () => {
    render(<LoginScreen />);
    const link = screen.getByRole('link', { name: /continue with google/i });
    expect(link.getAttribute('href')).toBe('/auth/google');
  });

  it('shows an allow-list error', () => {
    render(<LoginScreen error="That Google account is not allowed to use this app." />);
    expect(screen.getByRole('alert').textContent).toMatch(/not allowed/i);
  });
});
