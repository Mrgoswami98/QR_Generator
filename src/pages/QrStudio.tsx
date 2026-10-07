import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, Trash2, Save, RotateCcw, Sparkles } from 'lucide-react';
import type { DotStyle, EyeStyle, QrOptions, EccLevel } from '../lib/types';
import { renderQrSvg, qrCapacity } from '../lib/qr';
import { TEMPLATES, getTemplate, summarisePayload, type TemplateId } from '../lib/payloads';
import { svgToThumbnail } from '../lib/export';
import { newId } from '../lib/history';
import { useApp } from '../store';
import {
  Field,
  Input,
  Textarea,
  Select,
  Slider,
  ColorField,
  Toggle,
  Segmented,
  Panel,
  Collapsible,
} from '../components/ui';
import SymbolStage from '../components/SymbolStage';
import ExportPanel from '../components/ExportPanel';

const DOT_STYLES: { value: DotStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'diamond', label: 'Diamond' },
];

const EYE_STYLES: { value: EyeStyle; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'leaf', label: 'Leaf' },
];

const PRESETS: { name: string; patch: Partial<QrOptions> }[] = [
  {
    name: 'Classic',
    patch: {
      dotStyle: 'square',
      eyeStyle: 'square',
      foreground: '#000000',
      background: '#ffffff',
      gradient: { enabled: false, type: 'linear', rotation: 45, from: '#355ef7', to: '#13cf92' },
      eyeColor: null,
      eyeBallColor: null,
    },
  },
  {
    name: 'Soft',
    patch: {
      dotStyle: 'rounded',
      eyeStyle: 'rounded',
      foreground: '#111827',
      background: '#ffffff',
      gradient: { enabled: false, type: 'linear', rotation: 45, from: '#355ef7', to: '#13cf92' },
      eyeColor: null,
      eyeBallColor: null,
    },
  },
  {
    name: 'Ocean',
    patch: {
      dotStyle: 'dots',
      eyeStyle: 'circle',
      background: '#ffffff',
      gradient: { enabled: true, type: 'linear', rotation: 135, from: '#213dec', to: '#13cf92' },
      eyeColor: '#1b2aab',
      eyeBallColor: '#07a874',
    },
  },
  {
    name: 'Mono Bold',
    patch: {
      dotStyle: 'classy',
      eyeStyle: 'leaf',
      foreground: '#0b0f17',
      background: '#f5f7fa',
      gradient: { enabled: false, type: 'linear', rotation: 45, from: '#355ef7', to: '#13cf92' },
      eyeColor: null,
      eyeBallColor: null,
    },
  },
  {
    name: 'Sunset',
    patch: {
      dotStyle: 'rounded',
      eyeStyle: 'rounded',
      background: '#ffffff',
      gradient: { enabled: true, type: 'radial', rotation: 0, from: '#f97316', to: '#db2777' },
      eyeColor: '#db2777',
      eyeBallColor: '#f97316',
    },
  },
];

function defaultOptions(): QrOptions {
  return {
    data: 'https://github.com',
    ecc: 'M',
    size: 1024,
    margin: 4,
    foreground: '#0b0f17',
    background: '#ffffff',
    transparent: false,
    gradient: { enabled: false, type: 'linear', rotation: 45, from: '#355ef7', to: '#13cf92' },
    dotStyle: 'rounded',
    eyeStyle: 'rounded',
    eyeColor: null,
    eyeBallColor: null,
    logo: { src: null, scale: 0.2, excavate: true, radius: 22 },
  };
}

export default function QrStudio() {
  const location = useLocation();
  const { notify, addHistory } = useApp();

  const [options, setOptions] = useState<QrOptions>(defaultOptions);
  const [templateId, setTemplateId] = useState<TemplateId>('url');
  const [values, setValues] = useState<Record<string, string>>({ url: 'https://github.com' });
  const fileRef = useRef<HTMLInputElement>(null);

  const template = getTemplate(templateId);

  // Reopening an entry from History hands us a full options object.
  useEffect(() => {
    const restored = (location.state as { options?: QrOptions } | null)?.options;
    if (restored && 'dotStyle' in restored) {
      setOptions({ ...defaultOptions(), ...restored });
      setTemplateId('text');
      setValues({ text: restored.data });
    }
  }, [location.state]);

  const patch = (p: Partial<QrOptions>) => setOptions((o) => ({ ...o, ...p }));

  // Payload is derived from the active template, so switching templates never
  // leaves a stale string behind.
  const payload = useMemo(() => template.build(values), [template, values]);

  useEffect(() => {
    setOptions((o) => (o.data === payload ? o : { ...o, data: payload }));
  }, [payload]);

  const capacity = useMemo(
    () => (payload ? qrCapacity(payload, options.ecc) : { ok: false, message: '' }),
    [payload, options.ecc],
  );

  const { svg, error } = useMemo(() => {
    if (!payload) return { svg: '', error: null as string | null };
    try {
      return { svg: renderQrSvg({ ...options, data: payload }), error: null };
    } catch (err) {
      return {
        svg: '',
        error: err instanceof Error ? err.message : 'Could not render this QR code.',
      };
    }
  }, [options, payload]);

  function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Choose an image file for the logo.', 'error');
      return;
    }
    if (file.size > 1_500_000) {
      notify('Logo is larger than 1.5 MB. Use a smaller image to keep exports fast.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ logo: { ...options.logo, src: String(reader.result) } });
    reader.onerror = () => notify('Could not read that image.', 'error');
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!svg) return;
    const thumbnail = await svgToThumbnail(svg);
    await addHistory({
      id: newId(),
      kind: 'qr',
      title: summarisePayload(payload),
      data: payload,
      template: templateId,
      createdAt: Date.now(),
      options: { ...options, data: payload },
      thumbnail,
      favorite: false,
      tags: [templateId],
    });
    notify('Saved to history', 'success');
  }

  const filename = summarisePayload(payload).replace(/[^\w\s-]/g, '').trim() || 'qr-code';

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">QR Studio</h1>
        <p className="muted mt-1 text-[13px]">
          Pick what the code should do when scanned, then style it. The preview updates as you type.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------- Left: content + styling ---------------- */}
        <div className="space-y-4">
          <Panel title="Content">
            <Field
              label="What should this code do?"
              hint={template.scanResult}
              className="mb-4"
            >
              <Select
                value={templateId}
                onChange={(e) => {
                  const next = e.target.value as TemplateId;
                  setTemplateId(next);
                  setValues({});
                }}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {template.fields.map((f) => {
                const isWide = f.type === 'textarea' || f.key === 'url';
                const value = values[f.key] ?? '';
                const control =
                  f.type === 'textarea' ? (
                    <Textarea
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  ) : f.type === 'select' ? (
                    <Select
                      value={value || f.options?.[0]?.value || ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === 'checkbox' ? (
                    <Toggle
                      label={f.label}
                      checked={value === 'true'}
                      onChange={(c) => setValues((v) => ({ ...v, [f.key]: String(c) }))}
                    />
                  ) : (
                    <Input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  );

                return (
                  <Field
                    key={f.key}
                    label={f.type === 'checkbox' ? undefined : f.label}
                    hint={f.help}
                    className={isWide ? 'sm:col-span-2' : ''}
                  >
                    {control}
                  </Field>
                );
              })}
            </div>

            {payload && (
              <div
                className="mt-4 rounded-lg px-3 py-2.5"
                style={{ background: 'rgb(var(--surface-sunken))' }}
              >
                <p className="muted mb-1 text-[10.5px] font-semibold uppercase tracking-wider">
                  Encoded value
                </p>
                <p className="break-all font-mono text-[11.5px] leading-relaxed">
                  {payload.length > 300 ? `${payload.slice(0, 300)}…` : payload}
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Design">
            <div className="mb-4">
              <label className="field-label">Presets</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    className="btn-ghost px-3 py-1.5 text-[12px]"
                    onClick={() => patch(p.patch)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Module shape">
                <Select
                  value={options.dotStyle}
                  onChange={(e) => patch({ dotStyle: e.target.value as DotStyle })}
                >
                  {DOT_STYLES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Corner (eye) shape">
                <Select
                  value={options.eyeStyle}
                  onChange={(e) => patch({ eyeStyle: e.target.value as EyeStyle })}
                >
                  {EYE_STYLES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-1 divide-y">
              <Collapsible title="Colours" defaultOpen>
                <Toggle
                  label="Gradient fill"
                  description="Blend two colours across the modules."
                  checked={options.gradient.enabled}
                  onChange={(c) => patch({ gradient: { ...options.gradient, enabled: c } })}
                />

                {options.gradient.enabled ? (
                  <div className="space-y-3.5">
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <ColorField
                        label="Gradient from"
                        value={options.gradient.from}
                        onChange={(v) => patch({ gradient: { ...options.gradient, from: v } })}
                      />
                      <ColorField
                        label="Gradient to"
                        value={options.gradient.to}
                        onChange={(v) => patch({ gradient: { ...options.gradient, to: v } })}
                      />
                    </div>
                    <Segmented
                      value={options.gradient.type}
                      options={[
                        { value: 'linear', label: 'Linear' },
                        { value: 'radial', label: 'Radial' },
                      ]}
                      onChange={(v) => patch({ gradient: { ...options.gradient, type: v } })}
                    />
                    {options.gradient.type === 'linear' && (
                      <Slider
                        label="Gradient angle"
                        value={options.gradient.rotation}
                        min={0}
                        max={360}
                        unit="°"
                        onChange={(v) => patch({ gradient: { ...options.gradient, rotation: v } })}
                      />
                    )}
                  </div>
                ) : (
                  <ColorField
                    label="Module colour"
                    value={options.foreground}
                    onChange={(v) => patch({ foreground: v })}
                  />
                )}

                <ColorField
                  label="Background"
                  value={options.background}
                  disabled={options.transparent}
                  onChange={(v) => patch({ background: v })}
                />
                <Toggle
                  label="Transparent background"
                  description="PNG and SVG only — JPG and PDF flatten onto white."
                  checked={options.transparent}
                  onChange={(c) => patch({ transparent: c })}
                />

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Eye frame colour">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Eye frame colour"
                        value={options.eyeColor ?? options.foreground}
                        onChange={(e) => patch({ eyeColor: e.target.value })}
                      />
                      <button
                        className="btn-subtle px-2 py-1 text-[11.5px]"
                        onClick={() => patch({ eyeColor: null })}
                        disabled={options.eyeColor === null}
                      >
                        Match modules
                      </button>
                    </div>
                  </Field>
                  <Field label="Eye centre colour">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Eye centre colour"
                        value={options.eyeBallColor ?? options.eyeColor ?? options.foreground}
                        onChange={(e) => patch({ eyeBallColor: e.target.value })}
                      />
                      <button
                        className="btn-subtle px-2 py-1 text-[11.5px]"
                        onClick={() => patch({ eyeBallColor: null })}
                        disabled={options.eyeBallColor === null}
                      >
                        Match frame
                      </button>
                    </div>
                  </Field>
                </div>
              </Collapsible>

              <Collapsible title="Logo">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {options.logo.src ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {options.logo.src && (
                    <button
                      className="btn-subtle"
                      onClick={() => patch({ logo: { ...options.logo, src: null } })}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>

                {options.logo.src && (
                  <>
                    <Slider
                      label="Logo size"
                      value={Math.round(options.logo.scale * 100)}
                      min={8}
                      max={30}
                      unit="%"
                      onChange={(v) => patch({ logo: { ...options.logo, scale: v / 100 } })}
                    />
                    <Slider
                      label="Backdrop corner radius"
                      value={options.logo.radius}
                      min={0}
                      max={50}
                      unit="%"
                      onChange={(v) => patch({ logo: { ...options.logo, radius: v } })}
                    />
                    <Toggle
                      label="Clear space behind logo"
                      description="Strongly recommended — keeps the symbol scannable."
                      checked={options.logo.excavate}
                      onChange={(c) => patch({ logo: { ...options.logo, excavate: c } })}
                    />
                    <p className="muted text-[11.5px] leading-relaxed">
                      A logo covers data modules. Use error correction <strong>H</strong> and test
                      the printed code with a real scanner before a production run.
                    </p>
                  </>
                )}
              </Collapsible>

              <Collapsible title="Size &amp; reliability">
                <Field
                  label="Error correction"
                  hint="Higher levels survive damage and logos, but hold less data."
                >
                  <Segmented
                    value={options.ecc}
                    options={[
                      { value: 'L' as EccLevel, label: 'L · 7%' },
                      { value: 'M' as EccLevel, label: 'M · 15%' },
                      { value: 'Q' as EccLevel, label: 'Q · 25%' },
                      { value: 'H' as EccLevel, label: 'H · 30%' },
                    ]}
                    onChange={(v) => patch({ ecc: v })}
                  />
                </Field>
                <Slider
                  label="Quiet zone"
                  value={options.margin}
                  min={1}
                  max={10}
                  unit=" modules"
                  onChange={(v) => patch({ margin: v })}
                />
                <p className="muted text-[11.5px] leading-relaxed">
                  The QR specification calls for a quiet zone of 4 modules. Going below that can
                  stop some scanners from locking on.
                </p>
              </Collapsible>
            </div>

            <div className="mt-4 flex gap-2 border-t pt-4">
              <button className="btn-subtle" onClick={() => setOptions(defaultOptions())}>
                <RotateCcw className="h-4 w-4" />
                Reset design
              </button>
            </div>
          </Panel>
        </div>

        {/* ---------------- Right: preview + export ---------------- */}
        <div className="space-y-4 xl:sticky xl:top-[76px] xl:self-start">
          <Panel
            title="Live preview"
            action={
              <button className="btn-subtle px-2 py-1 text-[12px]" onClick={handleSave} disabled={!svg}>
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            }
          >
            <SymbolStage
              svg={svg}
              error={error}
              transparent={options.transparent}
              caption={
                payload && capacity.ok ? (
                  capacity.message
                ) : payload && !capacity.ok ? (
                  <span className="text-amber-500">{capacity.message}</span>
                ) : (
                  'Fill in the fields above'
                )
              }
            />
          </Panel>

          <Panel title="Export">
            <ExportPanel svg={svg} filename={filename} disabled={!svg} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
