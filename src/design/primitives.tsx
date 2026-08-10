import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

export function GhostButton({ className = '', type, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? 'button'}
      className={`cursor-pointer rounded-button border border-border-3 bg-transparent px-[12px] py-[8px] text-small text-secondary hover:border-border-5 hover:text-text ${className}`.trim()}
      {...props}
    />
  );
}

export function TogglePill({
  className = '',
  on,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  const stateClasses = on
    ? 'border-hand-right bg-hand-right-toggle-on-bg text-hand-right'
    : 'border-border-3 bg-transparent text-secondary';

  return (
    <button
      type={type ?? 'button'}
      aria-pressed={on}
      className={`cursor-pointer rounded-button border px-[11px] py-[7px] text-small ${stateClasses} ${className}`.trim()}
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

export function Modal({ children, title }: { children: ReactNode; title: string }) {
  const titleId = useId();

  return (
    <div className="fixed inset-0 grid place-items-center bg-backdrop p-[26px]">
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
