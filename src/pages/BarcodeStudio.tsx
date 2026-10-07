import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, RotateCcw, Wand2 } from 'lucide-react';
import type { BarcodeOptions } from '../lib/types';
import { renderBarcodeSvg } from '../lib/barcode';
import {
  SYMBOLOGIES,
  SYMBOLOGY_GROUPS,
  getSymbology,
  validateForSymbology,
  withCheckDigit,
} from '../lib/symbologies';
import { svgToThumbnail } from '../lib/export';
import { newId } from '../lib/history';
import { useApp } from '../store';
import { Field, Input, Select, Slider, ColorField, Toggle, Panel, Collapsible } from '../components/ui';
import SymbolStage from '../components/SymbolStage';
import ExportPanel from '../components/ExportPanel';

function defaultOptions(): BarcodeOptions {
  return {
    symbology: 'code128',
    data: 'SKU-48120-A',
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

export default function BarcodeStudio() {
  const location = useLocation();
  const { notify, addHistory } = useApp();
  const [options, setOptions] = useState<BarcodeOptions>(defaultOptions);

  useEffect(() => {
    const restored = (location.state as { options?: BarcodeOptions } | null)?.options;
    if (restored && 'symbology' in restored) {
      setOptions({ ...defaultOptions(), ...restored });
    }
  }, [location.state]);

  const patch = (p: Partial<BarcodeOptions>) => setOptions((o) => ({ ...o, ...p }));

  const symbology = getSymbology(options.symbology);

  // Pre-flight validation gives instant feedback; the encoder is still the
  // final authority and its error replaces this one when rendering fails.
  const inputError = useMemo(
    () => validateForSymbology(options.symbology, options.data),
    [options.symbology, options.data],
  );

  const { svg, error } = useMemo(() => {
    if (inputError) return { svg: '', error: inputError };
    try {
      return { svg: renderBarcodeSvg(options, { dpi: 300 }), error: null as string | null };
    } catch (err) {
      return { svg: '', error: err instanceof Error ? err.message : 'Could not encode this value.' };
    }
  }, [options, inputError]);

  const effectiveValue = options.addChecksum
    ? withCheckDigit(options.symbology, options.data)
    : options.data;
  const checkDigitAdded = effectiveValue !== options.data;

  async function handleSave() {
    if (!svg) return;
    const thumbnail = await svgToThumbnail(svg);
    await addHistory({
      id: newId(),
      kind: 'barcode',
      title: `${symbology.name} · ${options.data}`,
      data: options.data,
      template: options.symbology,
      createdAt: Date.now(),
      options: { ...options },
      thumbnail,
      favorite: false,
      tags: [options.symbology],
    });
    notify('Saved to history', 'success');
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Barcode Studio</h1>
        <p className="muted mt-1 text-[13px]">
          {SYMBOLOGIES.length} symbologies with specification-accurate encoding, sized in millimetres
          for real-world printing.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Panel title="Symbol">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Symbology" hint={symbology.hint}>
                <Select
                  value={options.symbology}
                  onChange={(e) => {
                    const next = e.target.value;
                    // Swap in the sample value so the preview is never broken
                    // immediately after changing symbology.
                    patch({ symbology: next, data: getSymbology(next).sample });
                  }}
                >
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

              <Field
                label="Value"
                error={inputError}
                hint={
                  checkDigitAdded
                    ? `Check digit added — encoding ${effectiveValue}`
                    : symbology.fixedLength
                      ? `${symbology.fixedLength} digits including the check digit.`
                      : undefined
                }
              >
                <div className="flex gap-2">
                  <Input
                    value={options.data}
                    aria-invalid={Boolean(inputError)}
                    spellCheck={false}
                    className="font-mono text-[12.5px]"
                    placeholder={symbology.sample}
                    onChange={(e) => patch({ data: e.target.value })}
                  />
                  <button
                    className="btn-ghost shrink-0 px-2.5"
                    title="Insert a valid sample value"
                    onClick={() => patch({ data: symbology.sample })}
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                </div>
              </Field>
            </div>

            {symbology.fixedLength && (
              <Toggle
                label="Add check digit automatically"
                description="Calculates the modulo-10 check digit when you enter the short form."
                checked={options.addChecksum}
                onChange={(c) => patch({ addChecksum: c })}
              />
            )}
          </Panel>

          <Panel title="Dimensions &amp; appearance" bodyClassName="p-4 pt-1">
            <div className="divide-y">
              <Collapsible title="Size" defaultOpen>
                <Slider
                  label="X-dimension (narrow bar width)"
                  value={options.scaleX}
                  min={0.15}
                  max={1.2}
                  step={0.01}
                  unit=" mm"
                  onChange={(v) => patch({ scaleX: v })}
                />
                <p className="muted -mt-1 text-[11.5px] leading-relaxed">
                  GS1 retail codes require at least 0.264 mm. Below roughly 0.25 mm most
                  thermal printers can no longer hold the tolerance.
                </p>

                {!symbology.twoD && (
                  <Slider
                    label="Bar height"
                    value={options.height}
                    min={4}
                    max={50}
                    step={0.5}
                    unit=" mm"
                    onChange={(v) => patch({ height: v })}
                  />
                )}

                <Slider
                  label="Quiet zone"
                  value={options.margin}
                  min={0}
                  max={10}
                  step={0.5}
                  unit=" mm"
                  onChange={(v) => patch({ margin: v })}
                />

                <Toggle
                  label="Rotate 90°"
                  description="Ladder orientation — fits a tall, narrow label."
                  checked={options.rotate}
                  onChange={(c) => patch({ rotate: c })}
                />
              </Collapsible>

              <Collapsible title="Human-readable text" defaultOpen={!symbology.twoD}>
                {symbology.twoD ? (
                  <p className="muted text-[12.5px] leading-relaxed">
                    {symbology.name} is a 2D symbol and does not carry a printed text line.
                  </p>
                ) : (
                  <>
                    <Toggle
                      label="Show text below the bars"
                      checked={options.includeText}
                      onChange={(c) => patch({ includeText: c })}
                    />
                    {options.includeText && (
                      <Slider
                        label="Text size"
                        value={options.textSize}
                        min={5}
                        max={24}
                        unit=" pt"
                        onChange={(v) => patch({ textSize: v })}
                      />
                    )}
                  </>
                )}
              </Collapsible>

              <Collapsible title="Colours">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <ColorField
                    label="Bar colour"
                    value={options.foreground}
                    onChange={(v) => patch({ foreground: v })}
                  />
                  <ColorField
                    label="Background"
                    value={options.background}
                    disabled={options.transparent}
                    onChange={(v) => patch({ background: v })}
                  />
                </div>
                <Toggle
                  label="Transparent background"
                  checked={options.transparent}
                  onChange={(c) => patch({ transparent: c })}
                />
                <p className="muted text-[11.5px] leading-relaxed">
                  Scanners read contrast, not colour. Keep dark bars on a light background — red
                  bars in particular are invisible to most red-laser scanners.
                </p>
              </Collapsible>
            </div>

            <div className="mt-4 flex gap-2 border-t pt-4">
              <button className="btn-subtle" onClick={() => setOptions(defaultOptions())}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </Panel>
        </div>

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
                svg
                  ? `${symbology.name} · X-dim ${options.scaleX} mm${
                      symbology.twoD ? '' : ` · ${options.height} mm tall`
                    }`
                  : undefined
              }
            />
          </Panel>

          <Panel title="Export">
            <ExportPanel
              svg={svg}
              filename={`${symbology.name}-${options.data}`}
              disabled={!svg}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
