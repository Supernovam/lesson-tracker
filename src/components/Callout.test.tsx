import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Callout } from './Callout';

describe('Callout', () => {
  it('announces an error as an alert with its title and detail', () => {
    render(
      <Callout tone="error" title="Sample failure">
        Sample detail text.
      </Callout>
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Sample failure');
    expect(alert.textContent).toContain('Sample detail text.');
    expect(alert.className).toContain('bg-red-50');
  });

  it('renders a warning as an inline note, not an alert', () => {
    render(<Callout tone="warning" title="Sample warning" />);

    expect(screen.queryByRole('alert')).toBeNull();
    const note = screen.getByRole('note');
    expect(note.textContent).toBe('Sample warning');
    expect(note.className).toContain('bg-amber-50');
  });

  it('shows a close button only when it can be dismissed', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Callout tone="error" title="Sample failure" />);
    expect(screen.queryByRole('button', { name: /dismiss message/i })).toBeNull();

    rerender(<Callout tone="error" title="Sample failure" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss message/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
