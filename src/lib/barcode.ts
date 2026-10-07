import bwipjs from 'bwip-js/browser';
import type { BarcodeOptions } from './types';
import { getSymbology, withCheckDigit } from './symbologies';

/**
 * Barcode rendering on top of BWIPP (via bwip-js), which implements the
 * published specifications for every symbology we expose.
 *
 * We standardise on SVG output: it is resolution independent, which matters a
 * great deal for barcodes — a rasterised symbol whose bar widths land on
 * fractional pixels will fail verification on a real scanner.
 */

/** Millimetres per inch, used to convert the X-dimension into bwip-js scale units. */
const MM_PER_INCH = 25.4;

/**
 * Symbologies whose payload is written with Application Identifiers in
 * parentheses and must be parsed rather than encoded literally.
 */
const GS1_SYMBOLOGIES = new Set([
  'gs1-128',
  'gs1datamatrix',
  'sscc18',
  'ean14',
  'databarexpanded',
  'databaromni',
  'databarlimited',
]);

/**
 * bwip-js `scale` is expressed in multiples of its base module size. Working in
 * millimetres is far more natural for label work, so we convert here using the
 * target print resolution.
 */
function mmToScale(mm: number, dpi: number): number {
  const dotsPerMm = dpi / MM_PER_INCH;
  return Math.max(0.3, mm * dotsPerMm);
}

export interface RenderContext {
  /** Target print resolution; drives the mm -> px conversion. */
  dpi: number;
}

export class BarcodeError extends Error {}

function buildOptions(options: BarcodeOptions, ctx: RenderContext) {
  const sym = getSymbology(options.symbology);
  const text = options.addChecksum
    ? withCheckDigit(options.symbology, options.data)
    : options.data;

  const scale = mmToScale(options.scaleX, ctx.dpi);

  const opts: Record<string, unknown> = {
    bcid: options.symbology,
    text,
    scale,
    includetext: options.includeText && !sym.twoD,
    textxalign: 'center',
    textsize: options.textSize,
    paddingwidth: mmToScale(options.margin, ctx.dpi),
    paddingheight: mmToScale(options.margin, ctx.dpi),
    backgroundcolor: options.transparent ? undefined : stripHash(options.background),
    barcolor: stripHash(options.foreground),
    textcolor: stripHash(options.foreground),
    rotate: options.rotate ? 'R' : 'N',
  };

  // 2D symbols size themselves from the data; forcing a height distorts them.
  if (!sym.twoD) {
    // bwip-js expresses height in millimetres already.
    opts.height = options.height;
  }

  // GS1 variants expect Application Identifier brackets to be parsed into FNC1
  // sequences rather than encoded as literal parentheses.
  if (GS1_SYMBOLOGIES.has(options.symbology)) {
    opts.parsefnc = true;
  }

  return opts;
}

/** bwip-js wants colours as bare hex, without the leading `#`. */
function stripHash(color: string): string {
  return color.replace(/^#/, '');
}

/**
 * Renders a barcode to an SVG string.
 * Throws {@link BarcodeError} with a readable message when the payload is not
 * valid for the chosen symbology.
 */
export function renderBarcodeSvg(
  options: BarcodeOptions,
  ctx: RenderContext = { dpi: 300 },
): string {
  try {
    return bwipjs.toSVG(buildOptions(options, ctx) as never);
  } catch (err) {
    throw new BarcodeError(humanise(err, options.symbology));
  }
}

/**
 * Turns BWIPP's terse PostScript-flavoured errors into something a warehouse
 * operator can act on.
 */
function humanise(err: unknown, symbology: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const name = getSymbology(symbology).name;
  const cleaned = raw.replace(/^bwipp\.\w+:\s*/i, '').trim();

  if (/must be .*digits|invalid length|not \d+ digits/i.test(cleaned)) {
    return `${name}: ${cleaned}. Check the number of digits.`;
  }
  if (/invalid character|character.*not/i.test(cleaned)) {
    return `${name} cannot encode one of these characters. ${cleaned}`;
  }
  if (/checksum|check digit/i.test(cleaned)) {
    return `${name}: the check digit does not match. Turn on "Auto check digit" or correct the last digit.`;
  }
  if (/too (long|much|large)/i.test(cleaned)) {
    return `${name}: the value is too long for this symbology.`;
  }
  return `${name}: ${cleaned || 'could not encode this value.'}`;
}

/**
 * Quick validity probe used for live form feedback. Cheaper than rendering at
 * full size because we encode at the minimum scale.
 */
export function probeBarcode(options: BarcodeOptions): string | null {
  try {
    bwipjs.toSVG({
      ...(buildOptions(options, { dpi: 96 }) as Record<string, unknown>),
      scale: 1,
      height: 10,
    } as never);
    return null;
  } catch (err) {
    return humanise(err, options.symbology);
  }
}
