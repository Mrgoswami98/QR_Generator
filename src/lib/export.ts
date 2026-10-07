import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import type { ExportFormat } from './types';

/**
 * Export pipeline.
 *
 * Every symbol is generated as SVG. Raster formats are produced by drawing
 * that SVG onto a canvas at the requested pixel size, so a 300 DPI print file
 * and an on-screen thumbnail share identical geometry and there is no second
 * renderer to keep in sync.
 */

/** Reads the `width`/`height` attributes from an SVG string. */
function svgDimensions(svg: string): { width: number; height: number } {
  const w = /width="([\d.]+)/.exec(svg)?.[1];
  const h = /height="([\d.]+)/.exec(svg)?.[1];
  if (w && h) return { width: Number(w), height: Number(h) };

  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (viewBox) {
    const [, , vw, vh] = viewBox.split(/[\s,]+/).map(Number);
    if (vw && vh) return { width: vw, height: vh };
  }
  return { width: 512, height: 512 };
}

/**
 * Rasterises an SVG string to a canvas.
 *
 * We use a base64 data URL rather than an object URL: Safari taints the canvas
 * for blob-backed SVG images, which would make `toDataURL` throw.
 */
export async function svgToCanvas(
  svg: string,
  targetWidth?: number,
  background?: string,
): Promise<HTMLCanvasElement> {
  const { width, height } = svgDimensions(svg);
  const scale = targetWidth ? targetWidth / width : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  const img = new Image();
  img.decoding = 'sync';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not rasterise the symbol.'));
    img.src = encoded;
  });

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function svgToPngBlob(svg: string, targetWidth?: number): Promise<Blob> {
  const canvas = await svgToCanvas(svg, targetWidth);
  return canvasToBlob(canvas, 'image/png');
}

export async function svgToJpgBlob(
  svg: string,
  targetWidth?: number,
  background = '#ffffff',
): Promise<Blob> {
  // JPEG has no alpha channel, so transparency must be flattened onto a colour
  // or it renders as black.
  const canvas = await svgToCanvas(svg, targetWidth, background);
  return canvasToBlob(canvas, 'image/jpeg', 0.95);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed.'))),
      type,
      quality,
    );
  });
}

/** Small PNG data URL used for history thumbnails. */
export async function svgToThumbnail(svg: string, size = 120): Promise<string> {
  try {
    const canvas = await svgToCanvas(svg, size, '#ffffff');
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * Wraps a single symbol in a PDF sized exactly to the artwork, with no page
 * margins — which is what a print shop or label printer expects.
 */
export async function svgToPdfBlob(svg: string, dpi = 300): Promise<Blob> {
  const { width, height } = svgDimensions(svg);
  // Convert CSS pixels (96/inch) to PDF points (72/inch).
  const ptW = (width / 96) * 72;
  const ptH = (height / 96) * 72;

  const pdf = new jsPDF({
    unit: 'pt',
    format: [ptW, ptH],
    orientation: ptW > ptH ? 'landscape' : 'portrait',
    compress: true,
  });

  // Rasterise at the target DPI so the symbol stays crisp when printed.
  const pixelWidth = Math.round((ptW / 72) * dpi);
  const canvas = await svgToCanvas(svg, pixelWidth, '#ffffff');
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, ptW, ptH, undefined, 'FAST');
  return pdf.output('blob');
}

export function sanitiseFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'code';
}

export interface DownloadOptions {
  format: ExportFormat;
  filename: string;
  /** Pixel width for raster exports. */
  pixelWidth?: number;
  dpi?: number;
}

/** Builds the export blob without triggering a download — used for ZIP bundles. */
export async function buildBlob(svg: string, opts: DownloadOptions): Promise<Blob> {
  switch (opts.format) {
    case 'svg':
      return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    case 'png':
      return svgToPngBlob(svg, opts.pixelWidth);
    case 'jpg':
      return svgToJpgBlob(svg, opts.pixelWidth);
    case 'pdf':
      return svgToPdfBlob(svg, opts.dpi ?? 300);
  }
}

export async function downloadSymbol(svg: string, opts: DownloadOptions): Promise<void> {
  const blob = await buildBlob(svg, opts);
  saveAs(blob, `${sanitiseFilename(opts.filename)}.${opts.format}`);
}

export interface ZipItem {
  svg: string;
  filename: string;
}

/** Bundles many symbols into one ZIP — the usual path for bulk generation. */
export async function downloadZip(
  items: ZipItem[],
  opts: Omit<DownloadOptions, 'filename'> & { zipName: string },
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const zip = new JSZip();
  const used = new Map<string, number>();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    let base = sanitiseFilename(item.filename);
    // Two rows may legitimately share a name; keep both rather than overwrite.
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    if (seen > 0) base = `${base}-${seen + 1}`;

    const blob = await buildBlob(item.svg, { ...opts, filename: base });
    zip.file(`${base}.${opts.format}`, blob);
    onProgress?.(i + 1, items.length);
  }

  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(out, `${sanitiseFilename(opts.zipName)}.zip`);
}

export function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    return Promise.reject(new Error('Clipboard images are not supported in this browser.'));
  }
  return navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}
