import QRCode from 'qrcode';
import type { QrOptions } from './types';

/**
 * A custom QR renderer.
 *
 * We take the raw module matrix from `qrcode` and draw it ourselves as SVG so
 * we can support dot shapes, neighbour-aware corner rounding, gradients,
 * separately styled finder patterns and a centre logo — none of which the
 * stock renderers expose.
 *
 * Everything is produced as SVG first and rasterised on demand, so a 4000px
 * PNG and a 120px thumbnail come from exactly the same geometry.
 */

export interface QrMatrix {
  /** Module count per side, excluding the quiet zone. */
  size: number;
  get(x: number, y: number): boolean;
}

export function buildMatrix(data: string, ecc: QrOptions['ecc']): QrMatrix {
  const qr = QRCode.create(data, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const bits = qr.modules.data;
  return {
    size,
    get(x, y) {
      if (x < 0 || y < 0 || x >= size || y >= size) return false;
      return bits[y * size + x] === 1;
    },
  };
}

/** The three 7x7 finder patterns live in these corners. */
function isFinderZone(x: number, y: number, size: number): boolean {
  return (
    (x < 7 && y < 7) || // top-left
    (x >= size - 7 && y < 7) || // top-right
    (x < 7 && y >= size - 7) // bottom-left
  );
}

function fmt(n: number): string {
  // Trim float noise so the SVG stays small and diff-friendly.
  return (Math.round(n * 1000) / 1000).toString();
}

/**
 * Rounded rectangle path with independent corner radii.
 * Corner order follows CSS: top-left, top-right, bottom-right, bottom-left.
 */
function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
): string {
  return [
    `M${fmt(x + tl)},${fmt(y)}`,
    `H${fmt(x + w - tr)}`,
    tr ? `A${fmt(tr)},${fmt(tr)} 0 0 1 ${fmt(x + w)},${fmt(y + tr)}` : '',
    `V${fmt(y + h - br)}`,
    br ? `A${fmt(br)},${fmt(br)} 0 0 1 ${fmt(x + w - br)},${fmt(y + h)}` : '',
    `H${fmt(x + bl)}`,
    bl ? `A${fmt(bl)},${fmt(bl)} 0 0 1 ${fmt(x)},${fmt(y + h - bl)}` : '',
    `V${fmt(y + tl)}`,
    tl ? `A${fmt(tl)},${fmt(tl)} 0 0 1 ${fmt(x + tl)},${fmt(y)}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Builds the path for one data module in the requested style. */
function modulePath(
  m: QrMatrix,
  x: number,
  y: number,
  ox: number,
  oy: number,
  style: QrOptions['dotStyle'],
): string {
  const px = x + ox;
  const py = y + oy;

  switch (style) {
    case 'dots':
      return `M${fmt(px + 0.5)},${fmt(py + 0.08)} a0.42,0.42 0 1 1 -0.001,0 Z`;

    case 'diamond':
      return `M${fmt(px + 0.5)},${fmt(py)} L${fmt(px + 1)},${fmt(py + 0.5)} L${fmt(
        px + 0.5,
      )},${fmt(py + 1)} L${fmt(px)},${fmt(py + 0.5)} Z`;

    case 'classy': {
      // Rounded on the top-left and bottom-right only — a distinctive,
      // slightly editorial look that still scans reliably.
      const r = 0.5;
      const up = m.get(x, y - 1);
      const left = m.get(x - 1, y);
      const down = m.get(x, y + 1);
      const right = m.get(x + 1, y);
      return roundedRect(
        px,
        py,
        1,
        1,
        up || left ? 0 : r,
        0,
        down || right ? 0 : r,
        0,
      );
    }

    case 'rounded': {
      // Neighbour-aware: a corner is only rounded when both touching edges are
      // free, so runs of modules merge into one smooth stroke.
      const r = 0.45;
      const up = m.get(x, y - 1);
      const down = m.get(x, y + 1);
      const left = m.get(x - 1, y);
      const right = m.get(x + 1, y);
      return roundedRect(
        px,
        py,
        1,
        1,
        !up && !left ? r : 0,
        !up && !right ? r : 0,
        !down && !right ? r : 0,
        !down && !left ? r : 0,
      );
    }

    case 'square':
    default:
      // A hairline overlap removes the seams antialiasing leaves between
      // neighbouring rectangles when the image is scaled up.
      return `M${fmt(px)},${fmt(py)} h${fmt(1.02)} v${fmt(1.02)} h${fmt(-1.02)} Z`;
  }
}

/** Outer ring (7x7 with a 5x5 hole) for one finder pattern. */
function eyeFramePath(x: number, y: number, style: QrOptions['eyeStyle']): string {
  const r =
    style === 'circle' ? 3.5 : style === 'rounded' ? 2 : style === 'leaf' ? 3.5 : 0;
  const innerR =
    style === 'circle' ? 2.5 : style === 'rounded' ? 1.2 : style === 'leaf' ? 2.5 : 0;

  if (style === 'leaf') {
    // Two opposite corners fully rounded, two square.
    return (
      roundedRect(x, y, 7, 7, r, 0, r, 0) +
      ' ' +
      roundedRect(x + 1, y + 1, 5, 5, innerR, 0, innerR, 0)
    );
  }
  return (
    roundedRect(x, y, 7, 7, r, r, r, r) +
    ' ' +
    roundedRect(x + 1, y + 1, 5, 5, innerR, innerR, innerR, innerR)
  );
}

/** Solid 3x3 centre of one finder pattern. */
function eyeBallPath(x: number, y: number, style: QrOptions['eyeStyle']): string {
  const r = style === 'circle' ? 1.5 : style === 'rounded' ? 0.9 : style === 'leaf' ? 1.5 : 0;
  if (style === 'leaf') return roundedRect(x + 2, y + 2, 3, 3, r, 0, r, 0);
  return roundedRect(x + 2, y + 2, 3, 3, r, r, r, r);
}

function gradientDef(o: QrOptions, id: string): string {
  const { gradient: g } = o;
  if (!g.enabled) return '';
  if (g.type === 'radial') {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${g.from}"/>
      <stop offset="100%" stop-color="${g.to}"/>
    </radialGradient>`;
  }
  const rad = ((g.rotation % 360) * Math.PI) / 180;
  const x1 = fmt(50 - Math.cos(rad) * 50);
  const y1 = fmt(50 - Math.sin(rad) * 50);
  const x2 = fmt(50 + Math.cos(rad) * 50);
  const y2 = fmt(50 + Math.sin(rad) * 50);
  return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      <stop offset="0%" stop-color="${g.from}"/>
      <stop offset="100%" stop-color="${g.to}"/>
    </linearGradient>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Renders the QR symbol as a standalone, self-contained SVG string.
 * Safe to write to a file, inline in the DOM or rasterise to a canvas.
 */
export function renderQrSvg(options: QrOptions): string {
  const m = buildMatrix(options.data, options.ecc);
  const margin = Math.max(1, options.margin);
  const span = m.size + margin * 2;
  const uid = `g${Math.random().toString(36).slice(2, 8)}`;

  const dataPaths: string[] = [];
  for (let y = 0; y < m.size; y += 1) {
    for (let x = 0; x < m.size; x += 1) {
      if (!m.get(x, y)) continue;
      if (isFinderZone(x, y, m.size)) continue;
      dataPaths.push(modulePath(m, x, y, margin, margin, options.dotStyle));
    }
  }

  const corners: Array<[number, number]> = [
    [margin, margin],
    [margin + m.size - 7, margin],
    [margin, margin + m.size - 7],
  ];
  const frames = corners.map(([x, y]) => eyeFramePath(x, y, options.eyeStyle)).join(' ');
  const balls = corners.map(([x, y]) => eyeBallPath(x, y, options.eyeStyle)).join(' ');

  const fill = options.gradient.enabled ? `url(#${uid})` : options.foreground;
  const eyeFill = options.eyeColor ?? fill;
  const ballFill = options.eyeBallColor ?? eyeFill;

  // Logo, centred, with an optional excavated backdrop so the quiet area
  // around it stays readable to scanners.
  let logo = '';
  if (options.logo.src) {
    const scale = Math.min(0.3, Math.max(0.08, options.logo.scale));
    const w = span * scale;
    const pos = (span - w) / 2;
    const pad = w * 0.12;
    const backdrop = options.logo.excavate
      ? `<rect x="${fmt(pos - pad)}" y="${fmt(pos - pad)}" width="${fmt(w + pad * 2)}" height="${fmt(
          w + pad * 2,
        )}" rx="${fmt((options.logo.radius / 100) * (w + pad * 2))}" fill="${
          options.transparent ? '#ffffff' : options.background
        }"/>`
      : '';
    logo =
      backdrop +
      `<image x="${fmt(pos)}" y="${fmt(pos)}" width="${fmt(w)}" height="${fmt(
        w,
      )}" href="${escapeXml(options.logo.src)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  const bg = options.transparent
    ? ''
    : `<rect width="${span}" height="${span}" fill="${options.background}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${
    options.size
  }" viewBox="0 0 ${span} ${span}" shape-rendering="geometricPrecision" role="img" aria-label="QR code">
<defs>${gradientDef(options, uid)}</defs>
${bg}
<path fill="${fill}" d="${dataPaths.join(' ')}"/>
<path fill="${eyeFill}" fill-rule="evenodd" d="${frames}"/>
<path fill="${ballFill}" d="${balls}"/>
${logo}
</svg>`;
}

/**
 * Estimated capacity feedback so the user learns *before* generating that a
 * payload will not fit at the chosen error-correction level.
 */
export function qrCapacity(data: string, ecc: QrOptions['ecc']): { ok: boolean; message: string } {
  try {
    const qr = QRCode.create(data, { errorCorrectionLevel: ecc });
    const version = qr.version;
    return {
      ok: true,
      message: `Version ${version} · ${qr.modules.size}×${qr.modules.size} modules · ${data.length} chars`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: /too long|big|data/i.test(msg)
        ? 'Payload is too long for a QR code. Shorten it or lower the error correction level.'
        : msg,
    };
  }
}
