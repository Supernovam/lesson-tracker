import type { ReactNode } from 'react';
import { CircleAlert, TriangleAlert, X } from 'lucide-react';

const toneStyles = {
  error: {
    box: 'border-red-200 bg-red-50',
    icon: 'text-red-600',
    title: 'text-red-800',
    body: 'text-red-700',
    dismiss: 'text-red-700 hover:bg-red-100 focus:ring-red-400',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
    dismiss: 'text-amber-800 hover:bg-amber-100 focus:ring-amber-400',
  },
} as const;

/**
 * A boxed message with an icon, a short title and optional detail. Errors are announced
 * as alerts; warnings are inline notes. Pass `onDismiss` to show a close button.
 */
export function Callout({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: 'error' | 'warning';
  title: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = toneStyles[tone];
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;

  return (
    <div
      className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${styles.box}`}
      role={tone === 'error' ? 'alert' : 'note'}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${styles.title}`}>{title}</p>
        {children && <div className={`mt-1 ${styles.body}`}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`-m-1 rounded-sm p-1 transition focus:outline-hidden focus:ring-2 ${styles.dismiss}`}
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
