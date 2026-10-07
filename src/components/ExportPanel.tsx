import { useState } from 'react';
import { Download, Copy, Printer, Check } from 'lucide-react';
import type { ExportFormat } from '../lib/types';
import { downloadSymbol, svgToPngBlob, copyBlobToClipboard } from '../lib/export';
import { useApp } from '../store';
import { Field, Select, Input, Spinner } from './ui';

const FORMATS: { value: ExportFormat; label: string; note: string }[] = [
  { value: 'png', label: 'PNG', note: 'Transparent background, universal' },
  { value: 'svg', label: 'SVG', note: 'Vector — scales to any size, best for print' },
  { value: 'jpg', label: 'JPG', note: 'Flattened on white, smallest file' },
  { value: 'pdf', label: 'PDF', note: 'Print-ready, sized to the artwork' },
];

const PRESET_SIZES = [256, 512, 1024, 2048, 4096];

export default function ExportPanel({
  svg,
  filename,
  disabled,
}: {
  svg: string;
  filename: string;
  disabled?: boolean;
}) {
  const notify = useApp((s) => s.notify);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [pixelWidth, setPixelWidth] = useState(1024);
  const [dpi, setDpi] = useState(300);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRaster = format === 'png' || format === 'jpg';

  async function handleDownload() {
    if (!svg || disabled) return;
    setBusy(true);
    try {
      await downloadSymbol(svg, { format, filename, pixelWidth, dpi });
      notify(`Downloaded ${filename}.${format}`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Export failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!svg || disabled) return;
    try {
      const blob = await svgToPngBlob(svg, pixelWidth);
      await copyBlobToClipboard(blob);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      notify('Image copied to clipboard', 'success');
    } catch {
      // Clipboard image writes are blocked in Firefox and on insecure origins.
      notify('Your browser blocked the image copy. Download the file instead.', 'error');
    }
  }

  function handlePrint() {
    if (!svg) return;
    const w = window.open('', '_blank', 'width=720,height=860');
    if (!w) {
      notify('Your browser blocked the print window. Allow pop-ups for this site.', 'error');
      return;
    }
    // A minimal print document: the symbol centred, nothing else on the page.
    w.document.write(
      `<!doctype html><html><head><title>${filename}</title><style>
        @page { margin: 12mm; }
        html,body { height:100%; margin:0; display:grid; place-items:center;
                    font-family: ui-sans-serif, system-ui, sans-serif; background:#fff; }
        figure { margin:0; text-align:center; }
        svg { max-width: 90vw; height: auto; }
        figcaption { margin-top: 10px; font-size: 11px; color:#555; word-break:break-all; }
      </style></head><body><figure>${svg}<figcaption>${filename}</figcaption></figure>
      <script>window.onload=function(){setTimeout(function(){window.print()},120)}<\/script>
      </body></html>`,
    );
    w.document.close();
  }

  return (
    <div className="space-y-3.5">
      <Field label="Format" hint={FORMATS.find((f) => f.value === format)?.note}>
        <div className="grid grid-cols-4 gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              aria-pressed={format === f.value}
              className={
                format === f.value
                  ? 'rounded-lg bg-brand-600 px-2 py-2 text-[12px] font-semibold text-white'
                  : 'btn-ghost px-2 py-2 text-[12px]'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </Field>

      {isRaster && (
        <Field label="Image width" hint={`Exports at ${pixelWidth} × ${pixelWidth} px.`}>
          <div className="flex gap-2">
            <Select
              value={PRESET_SIZES.includes(pixelWidth) ? String(pixelWidth) : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setPixelWidth(Number(e.target.value));
              }}
            >
              {PRESET_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} px
                </option>
              ))}
              <option value="custom">Custom…</option>
            </Select>
            <Input
              type="number"
              min={64}
              max={8192}
              step={32}
              value={pixelWidth}
              className="w-28"
              aria-label="Custom width in pixels"
              onChange={(e) =>
                setPixelWidth(Math.min(8192, Math.max(64, Number(e.target.value) || 64)))
              }
            />
          </div>
        </Field>
      )}

      {format === 'pdf' && (
        <Field label="Print resolution" hint="300 DPI is the standard for commercial label printing.">
          <Select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
            <option value={150}>150 DPI — draft</option>
            <option value={300}>300 DPI — standard print</option>
            <option value={600}>600 DPI — high precision</option>
          </Select>
        </Field>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <button className="btn-primary flex-1" onClick={handleDownload} disabled={disabled || busy || !svg}>
          {busy ? <Spinner /> : <Download className="h-4 w-4" />}
          Download
        </button>
        <button className="btn-ghost" onClick={handleCopy} disabled={disabled || !svg} title="Copy as PNG">
          {copied ? <Check className="h-4 w-4 text-accent-500" /> : <Copy className="h-4 w-4" />}
        </button>
        <button className="btn-ghost" onClick={handlePrint} disabled={disabled || !svg} title="Print">
          <Printer className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
