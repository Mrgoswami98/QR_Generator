import { clsx } from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The preview surface shared by both studios.
 *
 * The SVG is injected with `dangerouslySetInnerHTML` — the markup is generated
 * by our own renderers from values that are never interpreted as markup, so
 * there is no untrusted HTML path here.
 */
export default function SymbolStage({
  svg,
  error,
  transparent,
  caption,
  footer,
}: {
  svg: string;
  error?: string | null;
  transparent?: boolean;
  caption?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={clsx(
          'relative grid min-h-[280px] flex-1 place-items-center overflow-hidden rounded-xl2 p-6 sm:min-h-[360px]',
          transparent ? 'checkerboard' : '',
        )}
        style={{
          background: transparent ? undefined : 'rgb(var(--surface-sunken))',
          border: '1px solid rgb(var(--border))',
        }}
      >
        {error ? (
          <div className="max-w-xs text-center">
            <AlertTriangle className="mx-auto mb-2.5 h-7 w-7 text-amber-500" strokeWidth={1.8} />
            <p className="text-[13px] font-medium">Cannot generate yet</p>
            <p className="muted mt-1.5 text-[12.5px] leading-relaxed">{error}</p>
          </div>
        ) : svg ? (
          <div
            className="flex w-full max-w-[min(100%,360px)] items-center justify-center [&>svg]:h-auto [&>svg]:w-full"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="muted text-[13px]">Enter a value to see the preview</p>
        )}
      </div>

      {caption && <div className="muted mt-3 text-center text-[11.5px]">{caption}</div>}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
