import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { saveAs } from 'file-saver';
import { Upload, Plus, Trash2, Printer, GripVertical, FileDown } from 'lucide-react';
import type { LabelTemplate, LabelField, BarcodeOptions } from '../lib/types';
import {
  defaultLabelTemplate,
  LABEL_PRESETS,
  PAGE_SIZES,
  computeImposition,
  buildLabelPdf,
  interpolate,
  fieldDefaults,
  type PageSizeId,
  type LabelJob,
} from '../lib/labels';
import { parseFile, sampleCsv, type ParsedTable } from '../lib/importer';
import { renderBarcodeSvg } from '../lib/barcode';
import { renderQrSvg } from '../lib/qr';
import { SYMBOLOGIES, SYMBOLOGY_GROUPS, getSymbology } from '../lib/symbologies';
import { useApp } from '../store';
import {
  Field,
  Input,
  Select,
  Slider,
  Toggle,
  Segmented,
  Panel,
  Collapsible,
  Spinner,
  ProgressBar,
} from '../components/ui';

type SymbolKind = 'qr' | 'barcode';

const PLACEHOLDER_ROW: Record<string, string> = {
  sku: 'SKU-48120-A',
  name: 'M8 Hex Bolt — Zinc',
  batch: 'B-2026-04',
  mrp: '249.00',
  serial: 'SN-000124',
};

function barcodeOpts(symbology: string, data: string): BarcodeOptions {
  return {
    symbology,
    data,
    scaleX: 0.3,
    height: 12,
    includeText: true,
    textSize: 9,
    foreground: '#000000',
    background: '#ffffff',
    transparent: false,
    margin: 1,
    addChecksum: true,
    rotate: false,
  };
}

export default function Labels() {
  const notify = useApp((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<LabelTemplate>(defaultLabelTemplate);
  const [page, setPage] = useState<PageSizeId>('a4');
  const [kind, setKind] = useState<SymbolKind>('barcode');
  const [symbology, setSymbology] = useState('code128');
  const [payloadTemplate, setPayloadTemplate] = useState('{{sku}}');
  const [cropMarks, setCropMarks] = useState(false);
  const [dpi, setDpi] = useState(300);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const patch = (p: Partial<LabelTemplate>) => setTemplate((t) => ({ ...t, ...p }));

  const sampleRow = table?.rows[0] ?? PLACEHOLDER_ROW;
  const columns = table?.headers ?? Object.keys(PLACEHOLDER_ROW);

  /** The symbol shown in the live preview, built from the first data row. */
  const previewSvg = useMemo(() => {
    const payload = interpolate(payloadTemplate, sampleRow).trim() || 'SAMPLE';
    try {
      return kind === 'qr'
        ? renderQrSvg({
            data: payload,
            ecc: 'M',
            size: 300,
            margin: 2,
            foreground: '#000000',
            background: '#ffffff',
            transparent: false,
            gradient: { enabled: false, type: 'linear', rotation: 0, from: '#000', to: '#000' },
            dotStyle: 'square',
            eyeStyle: 'square',
            eyeColor: null,
            eyeBallColor: null,
            logo: { src: null, scale: 0.2, excavate: true, radius: 0 },
          })
        : renderBarcodeSvg(barcodeOpts(symbology, payload), { dpi: 300 });
    } catch {
      return '';
    }
  }, [kind, symbology, payloadTemplate, sampleRow]);

  const imposition = useMemo(() => computeImposition(template, page), [template, page]);
  const totalLabels = (table?.rows.length ?? 1) * copies;
  const pageCount = Math.ceil(totalLabels / imposition.perPage);

  // Scale the on-screen preview so a label of any size fits the panel neatly.
  const pxPerMm = Math.min(4.2, 320 / template.width);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = await parseFile(file);
      setTable(parsed);
      setFileName(file.name);
      const guess =
        parsed.headers.find((h) => /^(sku|code|id|barcode)$/i.test(h)) ?? parsed.headers[0];
      setPayloadTemplate(`{{${guess}}}`);
      notify(`Imported ${parsed.rows.length.toLocaleString()} rows`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that file.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function updateField(id: string, p: Partial<LabelField>) {
    patch({ fields: template.fields.map((f) => (f.id === id ? { ...f, ...p } : f)) });
  }

  async function handleExportPdf() {
    setBusy(true);
    setProgress({ done: 0, total: totalLabels });

    try {
      const rows = table?.rows ?? [sampleRow];
      const jobs: LabelJob[] = [];

      for (const row of rows) {
        const payload = interpolate(payloadTemplate, row).trim();
        if (!payload) continue;

        let svg: string;
        try {
          svg =
            kind === 'qr'
              ? renderQrSvg({
                  data: payload,
                  ecc: 'M',
                  size: 600,
                  margin: 2,
                  foreground: '#000000',
                  background: '#ffffff',
                  transparent: false,
                  gradient: { enabled: false, type: 'linear', rotation: 0, from: '#000', to: '#000' },
                  dotStyle: 'square',
                  eyeStyle: 'square',
                  eyeColor: null,
                  eyeBallColor: null,
                  logo: { src: null, scale: 0.2, excavate: true, radius: 0 },
                })
              : renderBarcodeSvg(barcodeOpts(symbology, payload), { dpi });
        } catch {
          // Skip rows that cannot be encoded rather than aborting the sheet.
          continue;
        }

        for (let c = 0; c < copies; c += 1) jobs.push({ svg, row });
      }

      if (jobs.length === 0) {
        notify('No labels could be generated. Check the payload template.', 'error');
        return;
      }

      const blob = await buildLabelPdf(jobs, template, page, { dpi, cropMarks }, (done, total) =>
        setProgress({ done, total }),
      );
      saveAs(blob, `${(fileName || 'labels').replace(/\.[^.]+$/, '')}-labels.pdf`);
      notify(`Exported ${jobs.length} labels across ${pageCount} page(s)`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Label export failed.', 'error');
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Label Designer</h1>
        <p className="muted mt-1 text-[13px]">
          Compose product labels with a symbol and text fields, then export a print-ready PDF sheet
          imposed for your label stock.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* -------- Controls -------- */}
        <div className="space-y-4">
          <Panel title="Data">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {table ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{fileName}</p>
                  <p className="muted text-[11.5px]">{table.rows.length.toLocaleString()} rows</p>
                </div>
                <button className="btn-subtle px-2 py-1 text-[12px]" onClick={() => setTable(null)}>
                  Clear
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="muted text-[12.5px] leading-relaxed">
                  Import a CSV or Excel file to print one label per row, or design against the
                  sample data shown in the preview.
                </p>
                <div className="flex gap-2">
                  <button className="btn-ghost flex-1" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Import data
                  </button>
                  <button
                    className="btn-subtle"
                    title="Download a sample CSV"
                    onClick={() =>
                      saveAs(new Blob([sampleCsv()], { type: 'text/csv' }), 'codeforge-sample.csv')
                    }
                  >
                    <FileDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Symbol">
            <Segmented
              value={kind}
              options={[
                { value: 'barcode' as SymbolKind, label: 'Barcode' },
                { value: 'qr' as SymbolKind, label: 'QR Code' },
              ]}
              onChange={setKind}
            />

            <div className="mt-3.5 space-y-3.5">
              {kind === 'barcode' && (
                <Field label="Symbology" hint={getSymbology(symbology).hint}>
                  <Select value={symbology} onChange={(e) => setSymbology(e.target.value)}>
                    {SYMBOLOGY_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {SYMBOLOGIES.filter((s) => s.group === g).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="Encoded value" hint="Use {{column}} placeholders.">
                <Input
                  value={payloadTemplate}
                  spellCheck={false}
                  className="font-mono text-[12.5px]"
                  onChange={(e) => setPayloadTemplate(e.target.value)}
                />
              </Field>

              <Field label="Position">
                <Segmented
                  size="sm"
                  value={template.symbolPosition}
                  options={[
                    { value: 'left' as const, label: 'Left' },
                    { value: 'right' as const, label: 'Right' },
                    { value: 'top' as const, label: 'Top' },
                  ]}
                  onChange={(v) => patch({ symbolPosition: v })}
                />
              </Field>

              <Slider
                label="Symbol width"
                value={Math.round(template.symbolScale * 100)}
                min={15}
                max={80}
                unit="% of label"
                onChange={(v) => patch({ symbolScale: v / 100 })}
              />
            </div>
          </Panel>

          <Panel title="Label geometry" bodyClassName="p-4 pt-1">
            <div className="divide-y">
              <Collapsible title="Size &amp; stock" defaultOpen>
                <Field label="Preset">
                  <Select
                    value={template.name}
                    onChange={(e) => {
                      const preset = LABEL_PRESETS.find((p) => p.name === e.target.value);
                      if (preset) patch({ ...preset.template, name: preset.name });
                    }}
                  >
                    {LABEL_PRESETS.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                    {!LABEL_PRESETS.some((p) => p.name === template.name) && (
                      <option value={template.name}>{template.name}</option>
                    )}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Width (mm)">
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      step={0.5}
                      value={template.width}
                      onChange={(e) =>
                        patch({ width: Math.max(10, Number(e.target.value) || 10), name: 'Custom' })
                      }
                    />
                  </Field>
                  <Field label="Height (mm)">
                    <Input
                      type="number"
                      min={8}
                      max={300}
                      step={0.5}
                      value={template.height}
                      onChange={(e) =>
                        patch({ height: Math.max(8, Number(e.target.value) || 8), name: 'Custom' })
                      }
                    />
                  </Field>
                </div>

                <Field label="Page size">
                  <Select value={page} onChange={(e) => setPage(e.target.value as PageSizeId)}>
                    {Object.entries(PAGE_SIZES).map(([id, p]) => (
                      <option key={id} value={id}>
                        {p.name} — {p.width} × {p.height} mm
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Page margin X (mm)">
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      step={0.5}
                      value={template.marginX}
                      onChange={(e) => patch({ marginX: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </Field>
                  <Field label="Page margin Y (mm)">
                    <Input
                      type="number"
                      min={0}
                      max={40}
                      step={0.5}
                      value={template.marginY}
                      onChange={(e) => patch({ marginY: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </Field>
                  <Field label="Gap X (mm)">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={template.gutterX}
                      onChange={(e) => patch({ gutterX: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </Field>
                  <Field label="Gap Y (mm)">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={template.gutterY}
                      onChange={(e) => patch({ gutterY: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </Field>
                </div>

                <Toggle
                  label="Draw label border"
                  checked={template.showBorder}
                  onChange={(c) => patch({ showBorder: c })}
                />
                <Toggle
                  label="Add cut guides"
                  description="Tick marks outside each label for trimming."
                  checked={cropMarks}
                  onChange={setCropMarks}
                />
              </Collapsible>

              <Collapsible title="Text fields" defaultOpen>
                <div className="space-y-2.5">
                  {template.fields.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg border p-2.5"
                      style={{ background: 'rgb(var(--surface-sunken))' }}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="muted h-4 w-4 shrink-0" />
                        <Input
                          value={f.value}
                          placeholder="Text or {{column}}"
                          spellCheck={false}
                          className="font-mono text-[12px]"
                          onChange={(e) => updateField(f.id, { value: e.target.value })}
                        />
                        <button
                          className="btn-subtle shrink-0 px-1.5 py-1.5"
                          aria-label="Remove field"
                          onClick={() =>
                            patch({ fields: template.fields.filter((x) => x.id !== f.id) })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-2 pl-6">
                        <Input
                          type="number"
                          min={4}
                          max={24}
                          step={0.5}
                          value={f.size}
                          aria-label="Font size"
                          className="w-[72px] text-[12px]"
                          onChange={(e) => updateField(f.id, { size: Number(e.target.value) || 8 })}
                        />
                        <button
                          className={
                            f.bold
                              ? 'btn rounded-md bg-brand-600 px-2 py-1.5 text-[12px] font-bold text-white'
                              : 'btn-ghost px-2 py-1.5 text-[12px] font-bold'
                          }
                          onClick={() => updateField(f.id, { bold: !f.bold })}
                        >
                          B
                        </button>
                        <Select
                          value={f.align}
                          aria-label="Alignment"
                          className="w-[92px] text-[12px]"
                          onChange={(e) =>
                            updateField(f.id, { align: e.target.value as LabelField['align'] })
                          }
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </Select>
                        <label className="muted ml-auto flex cursor-pointer items-center gap-1.5 text-[11.5px]">
                          <input
                            type="checkbox"
                            checked={f.show}
                            onChange={(e) => updateField(f.id, { show: e.target.checked })}
                          />
                          Show
                        </label>
                      </div>
                    </div>
                  ))}

                  <button
                    className="btn-ghost w-full"
                    onClick={() =>
                      patch({ fields: [...template.fields, fieldDefaults(`f${Date.now()}`)] })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add field
                  </button>

                  <div>
                    <label className="field-label">Columns — click to insert into the last field</label>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((c) => (
                        <button
                          key={c}
                          className="chip border font-mono text-[11px] transition hover:border-brand-500 hover:text-brand-500"
                          style={{ borderColor: 'rgb(var(--border))' }}
                          onClick={() => {
                            const last = template.fields[template.fields.length - 1];
                            if (last) updateField(last.id, { value: `${last.value}{{${c}}}` });
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Collapsible>
            </div>
          </Panel>
        </div>

        {/* -------- Preview + export -------- */}
        <div className="space-y-4">
          <Panel title="Label preview">
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative overflow-hidden rounded-sm shadow-lift"
                style={{
                  width: template.width * pxPerMm,
                  height: template.height * pxPerMm,
                  background: '#ffffff',
                  border: template.showBorder ? '1px solid #c9ced8' : '1px dashed #e2e6ec',
                  color: '#14181f',
                  display: 'flex',
                  flexDirection: template.symbolPosition === 'top' ? 'column' : 'row',
                  alignItems: 'center',
                  gap: `${1.6 * pxPerMm}px`,
                  padding: `${Math.min(2.5, template.width * 0.05) * pxPerMm}px`,
                }}
              >
                {template.symbolPosition === 'right' && (
                  <LabelText template={template} row={sampleRow} pxPerMm={pxPerMm} />
                )}

                <div
                  style={{
                    width:
                      template.symbolPosition === 'top'
                        ? `${template.width * template.symbolScale * pxPerMm}px`
                        : `${template.width * template.symbolScale * pxPerMm}px`,
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                  className="[&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />

                {template.symbolPosition !== 'right' && (
                  <LabelText template={template} row={sampleRow} pxPerMm={pxPerMm} />
                )}
              </div>

              <p className="muted text-center text-[11.5px]">
                {template.width} × {template.height} mm · shown at {Math.round(pxPerMm * 25.4)} DPI
                equivalent
              </p>
            </div>
          </Panel>

          <Panel title="Sheet layout">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Per page" value={imposition.perPage} sub={`${imposition.columns} × ${imposition.rows}`} />
              <Metric label="Labels" value={totalLabels.toLocaleString()} sub={`${copies} copy each`} />
              <Metric label="Pages" value={pageCount.toLocaleString()} />
              <Metric label="Stock" value={PAGE_SIZES[page].name} />
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Field label="Copies of each label">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                />
              </Field>
              <Field label="Print resolution">
                <Select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                  <option value={203}>203 DPI — thermal printer</option>
                  <option value={300}>300 DPI — standard</option>
                  <option value={600}>600 DPI — high precision</option>
                </Select>
              </Field>
            </div>

            <button className="btn-primary mt-4 w-full" onClick={handleExportPdf} disabled={busy}>
              {busy ? <Spinner /> : <Printer className="h-4 w-4" />}
              Export print-ready PDF
            </button>

            {busy && (
              <div className="mt-3 space-y-1.5">
                <ProgressBar value={progress.done} max={progress.total} />
                <p className="muted text-center text-[11.5px] tabular-nums">
                  Composing {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                </p>
              </div>
            )}

            <p className="muted mt-3 text-[11.5px] leading-relaxed">
              Print at 100% scale with page scaling turned off. Any &ldquo;fit to page&rdquo; setting
              will shrink the bars and can push the symbol out of specification.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function LabelText({
  template,
  row,
  pxPerMm,
}: {
  template: LabelTemplate;
  row: Record<string, string>;
  pxPerMm: number;
}) {
  const fields = template.fields.filter((f) => f.show);
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      {fields.map((f) => {
        const text = interpolate(f.value, row).trim();
        if (!text) return null;
        return (
          <div
            key={f.id}
            style={{
              // Font sizes are in points; 1pt ≈ 0.353mm.
              fontSize: `${f.size * 0.353 * pxPerMm}px`,
              fontWeight: f.bold ? 700 : 400,
              textAlign: f.align,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'rgb(var(--surface-sunken))' }}>
      <p className="muted text-[10.5px] font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="muted text-[10.5px]">{sub}</p>}
    </div>
  );
}
