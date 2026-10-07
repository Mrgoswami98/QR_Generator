import { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Package,
  Download,
  AlertCircle,
  CheckCircle2,
  FileDown,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import type { BarcodeOptions, ExportFormat, QrOptions } from '../lib/types';
import { parseFile, sampleCsv, buildManifestCsv, type ParsedTable } from '../lib/importer';
import { renderQrSvg } from '../lib/qr';
import { renderBarcodeSvg } from '../lib/barcode';
import { SYMBOLOGIES, SYMBOLOGY_GROUPS, getSymbology, validateForSymbology } from '../lib/symbologies';
import { interpolate } from '../lib/labels';
import { downloadZip, type ZipItem } from '../lib/export';
import { useApp } from '../store';
import {
  Field,
  Input,
  Select,
  Panel,
  Segmented,
  EmptyState,
  ProgressBar,
  Spinner,
  Slider,
  Toggle,
} from '../components/ui';

type Mode = 'qr' | 'barcode';

interface RowResult {
  index: number;
  payload: string;
  filename: string;
  svg: string;
  error: string | null;
}

function baseQrOptions(): QrOptions {
  return {
    data: '',
    ecc: 'M',
    size: 1024,
    margin: 4,
    foreground: '#0b0f17',
    background: '#ffffff',
    transparent: false,
    gradient: { enabled: false, type: 'linear', rotation: 45, from: '#355ef7', to: '#13cf92' },
    dotStyle: 'square',
    eyeStyle: 'square',
    eyeColor: null,
    eyeBallColor: null,
    logo: { src: null, scale: 0.2, excavate: true, radius: 22 },
  };
}

function baseBarcodeOptions(): BarcodeOptions {
  return {
    symbology: 'code128',
    data: '',
    scaleX: 0.33,
    height: 15,
    includeText: true,
    textSize: 10,
    foreground: '#000000',
    background: '#ffffff',
    transparent: false,
    margin: 2,
    addChecksum: true,
    rotate: false,
  };
}

export default function Bulk() {
  const notify = useApp((s) => s.notify);
  const fileRef = useRef<HTMLInputElement>(null);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [mode, setMode] = useState<Mode>('qr');

  const [payloadTemplate, setPayloadTemplate] = useState('{{sku}}');
  const [nameTemplate, setNameTemplate] = useState('{{sku}}');
  const [symbology, setSymbology] = useState('code128');
  const [ecc, setEcc] = useState<QrOptions['ecc']>('M');
  const [scaleX, setScaleX] = useState(0.33);
  const [barHeight, setBarHeight] = useState(15);
  const [includeText, setIncludeText] = useState(true);

  const [format, setFormat] = useState<ExportFormat>('png');
  const [pixelWidth, setPixelWidth] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    try {
      const parsed = await parseFile(file);
      setTable(parsed);
      setFileName(file.name);

      // Guess sensible defaults from the column names so the first preview is
      // usually already correct.
      const headers = parsed.headers;
      const guess =
        headers.find((h) => /^(url|link|website)$/i.test(h)) ??
        headers.find((h) => /^(sku|code|id|barcode|item)$/i.test(h)) ??
        headers[0];
      const label =
        headers.find((h) => /^(sku|code|id|item)$/i.test(h)) ??
        headers.find((h) => /^(name|title|product)$/i.test(h)) ??
        guess;
      setPayloadTemplate(`{{${guess}}}`);
      setNameTemplate(`{{${label}}}`);

      parsed.warnings.forEach((w) => notify(w, 'info'));
      notify(`Imported ${parsed.rows.length.toLocaleString()} rows`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that file.', 'error');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /**
   * Generates every row. Capped preview rendering keeps the UI responsive —
   * the full set is only rendered at export time.
   */
  const results: RowResult[] = useMemo(() => {
    if (!table) return [];
    const preview = table.rows.slice(0, 24);

    return preview.map((row, i) => {
      const payload = interpolate(payloadTemplate, row).trim();
      const filename = interpolate(nameTemplate, row).trim() || `code-${i + 1}`;

      if (!payload) {
        return { index: i, payload, filename, svg: '', error: 'Payload is empty for this row.' };
      }

      try {
        if (mode === 'qr') {
          return {
            index: i,
            payload,
            filename,
            svg: renderQrSvg({ ...baseQrOptions(), data: payload, ecc, size: 300 }),
            error: null,
          };
        }
        const invalid = validateForSymbology(symbology, payload);
        if (invalid) return { index: i, payload, filename, svg: '', error: invalid };

        return {
          index: i,
          payload,
          filename,
          svg: renderBarcodeSvg(
            { ...baseBarcodeOptions(), symbology, data: payload, scaleX, height: barHeight, includeText },
            { dpi: 300 },
          ),
          error: null,
        };
      } catch (err) {
        return {
          index: i,
          payload,
          filename,
          svg: '',
          error: err instanceof Error ? err.message : 'Could not encode.',
        };
      }
    });
  }, [table, payloadTemplate, nameTemplate, mode, ecc, symbology, scaleX, barHeight, includeText]);

  const previewErrors = results.filter((r) => r.error).length;

  async function handleGenerateAll() {
    if (!table) return;
    setBusy(true);
    setProgress({ done: 0, total: table.rows.length });

    const items: ZipItem[] = [];
    const manifest: { filename: string; payload: string; status: string }[] = [];
    let failed = 0;

    try {
      for (let i = 0; i < table.rows.length; i += 1) {
        const row = table.rows[i];
        const payload = interpolate(payloadTemplate, row).trim();
        const filename = interpolate(nameTemplate, row).trim() || `code-${i + 1}`;

        try {
          if (!payload) throw new Error('Empty payload');
          const svg =
            mode === 'qr'
              ? renderQrSvg({ ...baseQrOptions(), data: payload, ecc, size: pixelWidth })
              : renderBarcodeSvg(
                  {
                    ...baseBarcodeOptions(),
                    symbology,
                    data: payload,
                    scaleX,
                    height: barHeight,
                    includeText,
                  },
                  { dpi: 300 },
                );
          items.push({ svg, filename });
          manifest.push({ filename: `${filename}.${format}`, payload, status: 'ok' });
        } catch (err) {
          failed += 1;
          manifest.push({
            filename: `${filename}.${format}`,
            payload,
            status: `error: ${err instanceof Error ? err.message : 'failed'}`,
          });
        }

        // Yield to the event loop periodically so the progress bar actually paints.
        if (i % 25 === 0) {
          setProgress({ done: i, total: table.rows.length });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (items.length === 0) {
        notify('No rows could be encoded. Check the payload template and symbology.', 'error');
        return;
      }

      await downloadZip(
        items,
        { format, pixelWidth, zipName: `${fileName.replace(/\.[^.]+$/, '')}-codes` },
        (done, total) => setProgress({ done, total }),
      );

      saveAs(
        new Blob([buildManifestCsv(manifest)], { type: 'text/csv' }),
        `${fileName.replace(/\.[^.]+$/, '')}-manifest.csv`,
      );

      notify(
        failed > 0
          ? `Generated ${items.length} codes. ${failed} row(s) failed — see the manifest.`
          : `Generated ${items.length} codes`,
        failed > 0 ? 'info' : 'success',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bulk generation failed.', 'error');
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  function downloadSample() {
    saveAs(new Blob([sampleCsv()], { type: 'text/csv' }), 'codeforge-sample.csv');
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Bulk Generate</h1>
        <p className="muted mt-1 text-[13px]">
          Import a CSV or Excel file and generate a code for every row. Everything is processed in
          your browser — nothing is uploaded.
        </p>
      </header>

      {!table ? (
        <Panel>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="rounded-xl2 border-2 border-dashed p-2"
          >
            <EmptyState
              icon={<FileSpreadsheet className="h-10 w-10" strokeWidth={1.5} />}
              title={parsing ? 'Reading your file…' : 'Drop a CSV or Excel file here'}
              description="The first row must contain column names. Values keep their exact text, so leading zeros in SKUs survive the import."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={parsing}>
                    {parsing ? <Spinner /> : <Upload className="h-4 w-4" />}
                    Choose file
                  </button>
                  <button className="btn-ghost" onClick={downloadSample}>
                    <FileDown className="h-4 w-4" />
                    Sample CSV
                  </button>
                </div>
              }
            />
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* ------- Configuration ------- */}
          <div className="space-y-4">
            <Panel
              title="Source"
              action={
                <button className="btn-subtle px-2 py-1 text-[12px]" onClick={() => setTable(null)}>
                  Change file
                </button>
              }
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-500/12 text-accent-500">
                  <CheckCircle2 className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{fileName}</p>
                  <p className="muted text-[11.5px]">
                    {table.rows.length.toLocaleString()} rows · {table.headers.length} columns
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Code type">
              <Segmented
                value={mode}
                options={[
                  { value: 'qr' as Mode, label: 'QR Code' },
                  { value: 'barcode' as Mode, label: 'Barcode' },
                ]}
                onChange={setMode}
              />

              {mode === 'barcode' ? (
                <div className="mt-3.5 space-y-3.5">
                  <Field label="Symbology" hint={getSymbology(symbology).hint}>
                    <Select value={symbology} onChange={(e) => setSymbology(e.target.value)}>
                      {SYMBOLOGY_GROUPS.map((group) => (
                        <optgroup key={group} label={group}>
                          {SYMBOLOGIES.filter((s) => s.group === group).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Slider
                    label="X-dimension"
                    value={scaleX}
                    min={0.15}
                    max={1}
                    step={0.01}
                    unit=" mm"
                    onChange={setScaleX}
                  />
                  {!getSymbology(symbology).twoD && (
                    <>
                      <Slider
                        label="Bar height"
                        value={barHeight}
                        min={4}
                        max={40}
                        step={0.5}
                        unit=" mm"
                        onChange={setBarHeight}
                      />
                      <Toggle
                        label="Show text below bars"
                        checked={includeText}
                        onChange={setIncludeText}
                      />
                    </>
                  )}
                </div>
              ) : (
                <Field label="Error correction" className="mt-3.5">
                  <Segmented
                    value={ecc}
                    options={[
                      { value: 'L' as const, label: 'L' },
                      { value: 'M' as const, label: 'M' },
                      { value: 'Q' as const, label: 'Q' },
                      { value: 'H' as const, label: 'H' },
                    ]}
                    onChange={setEcc}
                  />
                </Field>
              )}
            </Panel>

            <Panel title="Templates">
              <div className="space-y-3.5">
                <Field
                  label="Encoded value"
                  hint="Use {{column}} to insert data from a column."
                >
                  <Input
                    value={payloadTemplate}
                    spellCheck={false}
                    className="font-mono text-[12.5px]"
                    onChange={(e) => setPayloadTemplate(e.target.value)}
                  />
                </Field>

                <Field label="File name" hint="Duplicate names get a numeric suffix automatically.">
                  <Input
                    value={nameTemplate}
                    spellCheck={false}
                    className="font-mono text-[12.5px]"
                    onChange={(e) => setNameTemplate(e.target.value)}
                  />
                </Field>

                <div>
                  <label className="field-label">Available columns — click to insert</label>
                  <div className="flex flex-wrap gap-1.5">
                    {table.headers.map((h) => (
                      <button
                        key={h}
                        className="chip border font-mono text-[11px] transition hover:border-brand-500 hover:text-brand-500"
                        style={{ borderColor: 'rgb(var(--border))' }}
                        onClick={() => setPayloadTemplate((p) => `${p}{{${h}}}`)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Output">
              <div className="space-y-3.5">
                <Field label="Format">
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['png', 'svg', 'jpg', 'pdf'] as ExportFormat[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={
                          format === f
                            ? 'rounded-lg bg-brand-600 px-2 py-2 text-[12px] font-semibold uppercase text-white'
                            : 'btn-ghost px-2 py-2 text-[12px] uppercase'
                        }
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </Field>

                {(format === 'png' || format === 'jpg') && (
                  <Field label="Image width">
                    <Select value={pixelWidth} onChange={(e) => setPixelWidth(Number(e.target.value))}>
                      {[256, 512, 1024, 2048].map((s) => (
                        <option key={s} value={s}>
                          {s} px
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <button
                  className="btn-primary w-full"
                  onClick={handleGenerateAll}
                  disabled={busy || table.rows.length === 0}
                >
                  {busy ? <Spinner /> : <Package className="h-4 w-4" />}
                  Generate {table.rows.length.toLocaleString()} codes
                </button>

                {busy && (
                  <div className="space-y-1.5">
                    <ProgressBar value={progress.done} max={progress.total} />
                    <p className="muted text-center text-[11.5px] tabular-nums">
                      {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                    </p>
                  </div>
                )}

                <p className="muted text-[11.5px] leading-relaxed">
                  <Download className="mr-1 inline h-3 w-3" />
                  You get a ZIP of all codes plus a CSV manifest mapping every file to its
                  encoded value.
                </p>
              </div>
            </Panel>
          </div>

          {/* ------- Preview grid ------- */}
          <Panel
            title={`Preview — first ${results.length} of ${table.rows.length.toLocaleString()}`}
            action={
              previewErrors > 0 ? (
                <span className="chip bg-amber-500/12 text-amber-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {previewErrors} with issues
                </span>
              ) : (
                <span className="chip bg-accent-500/12 text-accent-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  All valid
                </span>
              )
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((r) => (
                <figure
                  key={r.index}
                  className="overflow-hidden rounded-lg border"
                  style={{ background: 'rgb(var(--surface-raised))' }}
                >
                  <div
                    className="grid aspect-square place-items-center p-3"
                    style={{ background: '#ffffff' }}
                  >
                    {r.error ? (
                      <AlertCircle className="h-6 w-6 text-amber-500" strokeWidth={1.8} />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center [&>svg]:h-auto [&>svg]:max-h-full [&>svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: r.svg }}
                      />
                    )}
                  </div>
                  <figcaption className="border-t px-2.5 py-2">
                    <p className="truncate text-[11.5px] font-medium" title={r.filename}>
                      {r.filename}
                    </p>
                    <p
                      className={`truncate text-[10.5px] ${r.error ? 'text-amber-500' : 'muted'}`}
                      title={r.error ?? r.payload}
                    >
                      {r.error ?? r.payload}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
