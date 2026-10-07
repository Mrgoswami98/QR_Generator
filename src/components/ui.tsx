import { clsx } from 'clsx';
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Small, unopinionated form and layout primitives shared across the studio. */

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] leading-snug text-red-500">{error}</p>
      ) : hint ? (
        <p className="muted mt-1.5 text-[11.5px] leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input-base', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('input-base resize-y', className)} rows={3} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('input-base cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="field-label mb-0">{label}</label>
        <span className="font-mono text-[11.5px] tabular-nums" style={{ color: 'rgb(var(--text))' }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          value={value.toUpperCase()}
          disabled={disabled}
          spellCheck={false}
          className="font-mono text-[12.5px] uppercase"
          onChange={(e) => {
            const v = e.target.value.trim();
            // Only commit once it is a complete hex colour, so typing does not
            // flash the preview through invalid intermediate values.
            if (/^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{3}$/i.test(v)) onChange(v);
          }}
        />
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg py-1.5 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {description && <span className="muted block text-[11.5px] leading-snug">{description}</span>}
      </span>
      <span
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-brand-600' : 'bg-[rgb(var(--border))]',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      className="flex gap-1 rounded-lg p-1"
      style={{ background: 'rgb(var(--surface-sunken))', border: '1px solid rgb(var(--border))' }}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          title={o.title}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex-1 rounded-md font-medium transition',
            size === 'sm' ? 'px-2 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12.5px]',
            value === o.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'muted hover:bg-[rgb(var(--border))]/50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('panel', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      <div className={clsx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[13px] font-semibold tracking-tight marker:content-none">
        {title}
        <svg
          className="muted h-4 w-4 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-3.5 pb-4">{children}</div>
    </details>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="muted mb-3 opacity-60">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="muted mt-1.5 max-w-sm text-[13px] leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel p-4">
      <p className="muted text-[11.5px] font-medium tracking-wide">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="muted mt-0.5 text-[11.5px]">{sub}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: 'rgb(var(--border))' }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
