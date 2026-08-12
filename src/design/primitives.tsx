import { useEffect, useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { alpha, color } from './tokens';

export const GHOST_BUTTON_CLASS_NAME =
  'cursor-pointer rounded-button border border-border-3 bg-transparent px-[12px] py-[8px] text-small text-secondary hover:border-border-5 hover:text-text';

export function GhostButton({ className = '', type, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      className={`${GHOST_BUTTON_CLASS_NAME} ${className}`.trim()}
      {...props}
    />
  );
}

export function TogglePill({
  className = '',
  on,
  accent = 'hand-right',
  style,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; accent?: 'hand-right' | 'listening' }) {
  const listening = accent === 'listening';
  const stateClasses = on
    ? listening
      ? 'border-listening text-listening-text'
      : 'border-hand-right bg-hand-right-toggle-on-bg text-hand-right'
    : 'border-border-3 bg-transparent text-secondary';
  const activeStyle = on && listening
    ? {
        borderColor: color.listening,
        backgroundColor: `${color.listening}${alpha.toggleOnBg}`,
        color: color.listening,
      }
    : undefined;

  return (
    <button
      type={type ?? 'button'}
      aria-pressed={on}
      className={`cursor-pointer rounded-button border px-[11px] py-[7px] text-small ${stateClasses} ${className}`.trim()}
      style={{ ...activeStyle, ...style }}
      {...props}
    />
  );
}

export function StatusBanner({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={`flex items-start gap-[10px] rounded-input border border-amber-border bg-amber-bg px-[16px] py-[14px] text-body-sm leading-[1.5] text-amber-text ${className}`.trim()}
      {...props}
    >
      <span aria-hidden="true" className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-[50%] bg-amber" />
      {children}
    </div>
  );
}

export function MonoLabel({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-mono text-mono-label uppercase tracking-[0.1em] text-mono-dim-2 ${className}`.trim()}
      {...props}
    />
  );
}

export function ErrorPanel({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-[10px] rounded-input border border-error-border bg-error-bg px-[15px] py-[13px] text-body-sm leading-[1.5] text-error-text ${className}`.trim()}
      {...props}
    >
      <span aria-hidden="true" className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-[50%] bg-error" />
      {children}
    </div>
  );
}

export function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose?: () => void;
  title: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      data-testid="modal-backdrop"
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-backdrop p-[26px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[460px] flex-col gap-[20px] rounded-modal border border-border-3 bg-raised p-[26px]"
      >
        <h2 id={titleId} className="text-heading font-medium">
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}
