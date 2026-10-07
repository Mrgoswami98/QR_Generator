import { jsPDF } from 'jspdf';
import type { LabelTemplate, LabelField } from './types';
import { svgToCanvas } from './export';

/**
 * Label composition and print-sheet imposition.
 *
 * Everything is measured in millimetres, which is how label stock is sold and
 * how operators think. jsPDF works natively in mm so there is no conversion
 * layer to get wrong.
 */

export const PAGE_SIZES = {
  a4: { name: 'A4', width: 210, height: 297 },
  letter: { name: 'US Letter', width: 215.9, height: 279.4 },
  a5: { name: 'A5', width: 148, height: 210 },
  roll100x150: { name: 'Thermal roll 100×150', width: 100, height: 150 },
  roll50x25: { name: 'Thermal roll 50×25', width: 50, height: 25 },
} as const;

export type PageSizeId = keyof typeof PAGE_SIZES;

export const LABEL_PRESETS: { id: string; name: string; template: Partial<LabelTemplate> }[] = [
  {
    id: 'shelf-50x25',
    name: 'Shelf label 50 × 25 mm',
    template: { width: 50, height: 25, symbolPosition: 'left', symbolScale: 0.34 },
  },
  {
    id: 'product-70x37',
    name: 'Product label 70 × 37 mm',
    template: { width: 70, height: 37, symbolPosition: 'left', symbolScale: 0.3 },
  },
  {
    id: 'carton-100x50',
    name: 'Carton label 100 × 50 mm',
    template: { width: 100, height: 50, symbolPosition: 'left', symbolScale: 0.32 },
  },
  {
    id: 'asset-40x20',
    name: 'Asset tag 40 × 20 mm',
    template: { width: 40, height: 20, symbolPosition: 'left', symbolScale: 0.4 },
  },
  {
    id: 'square-40',
    name: 'Square QR tag 40 × 40 mm',
    template: { width: 40, height: 40, symbolPosition: 'top', symbolScale: 0.62 },
  },
];

export function defaultLabelTemplate(): LabelTemplate {
  return {
    id: 'default',
    name: 'Product label 70 × 37 mm',
    width: 70,
    height: 37,
    marginX: 8,
    marginY: 10,
    gutterX: 2,
    gutterY: 2,
    symbolPosition: 'left',
    symbolScale: 0.3,
    showBorder: true,
    fields: [
      { id: 'f1', label: 'Product', value: '{{name}}', size: 9, bold: true, align: 'left', show: true },
      { id: 'f2', label: 'SKU', value: 'SKU: {{sku}}', size: 7.5, bold: false, align: 'left', show: true },
      { id: 'f3', label: 'Batch', value: 'Batch: {{batch}}', size: 7, bold: false, align: 'left', show: true },
      { id: 'f4', label: 'MRP', value: 'MRP ₹{{mrp}}', size: 8.5, bold: true, align: 'left', show: true },
    ],
  };
}

/**
 * Substitutes `{{column}}` placeholders from a data row.
 * Unresolved placeholders collapse to an empty string so a half-filled CSV
 * produces a clean label rather than literal braces on the artwork.
 */
export function interpolate(text: string, row: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w\s.-]+?)\s*\}\}/g, (_, key: string) => {
    const direct = row[key];
    if (direct != null) return direct;
    // Fall back to a case-insensitive match so "SKU" finds the "sku" column.
    const lower = key.toLowerCase();
    const hit = Object.keys(row).find((k) => k.toLowerCase() === lower);
    return hit ? row[hit] : '';
  });
}

/** Resolves every visible field on a label against one data row. */
export function resolveFields(template: LabelTemplate, row: Record<string, string>): string[] {
  return template.fields
    .filter((f) => f.show)
    .map((f) => interpolate(f.value, row))
    .filter((t) => t.trim().length > 0);
}

/** How many labels fit on one page, and where each one goes. */
export interface Imposition {
  columns: number;
  rows: number;
  perPage: number;
  positions: { x: number; y: number }[];
}

export function computeImposition(template: LabelTemplate, page: PageSizeId): Imposition {
  const { width: pw, height: ph } = PAGE_SIZES[page];
  const usableW = pw - template.marginX * 2;
  const usableH = ph - template.marginY * 2;

  const columns = Math.max(
    1,
    Math.floor((usableW + template.gutterX) / (template.width + template.gutterX)),
  );
  const rows = Math.max(
    1,
    Math.floor((usableH + template.gutterY) / (template.height + template.gutterY)),
  );

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      positions.push({
        x: template.marginX + c * (template.width + template.gutterX),
        y: template.marginY + r * (template.height + template.gutterY),
      });
    }
  }

  return { columns, rows, perPage: columns * rows, positions };
}

export interface LabelJob {
  /** SVG of the symbol to place on this label. */
  svg: string;
  /** Data row used to resolve text fields. */
  row: Record<string, string>;
}

/** Converts mm to the pixel width needed to hit `dpi` when printed. */
function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * Renders a full, print-ready PDF sheet: every label imposed on the page grid,
 * symbols rasterised at the target DPI, optional cut guides.
 */
export async function buildLabelPdf(
  jobs: LabelJob[],
  template: LabelTemplate,
  page: PageSizeId,
  options: { dpi?: number; cropMarks?: boolean } = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const dpi = options.dpi ?? 300;
  const { width: pw, height: ph } = PAGE_SIZES[page];
  const layout = computeImposition(template, page);

  const pdf = new jsPDF({
    unit: 'mm',
    format: [pw, ph],
    orientation: pw > ph ? 'landscape' : 'portrait',
    compress: true,
  });
  pdf.setFont('helvetica', 'normal');

  const pad = Math.min(2.5, template.width * 0.05);

  for (let i = 0; i < jobs.length; i += 1) {
    const slot = i % layout.perPage;
    if (i > 0 && slot === 0) pdf.addPage([pw, ph], pw > ph ? 'landscape' : 'portrait');

    const { x, y } = layout.positions[slot];
    const job = jobs[i];

    if (template.showBorder) {
      pdf.setDrawColor(190);
      pdf.setLineWidth(0.15);
      pdf.rect(x, y, template.width, template.height);
    }

    // --- Symbol ---------------------------------------------------------
    const topLayout = template.symbolPosition === 'top';
    const symbolW = topLayout
      ? template.width * template.symbolScale
      : template.width * template.symbolScale;

    const canvas = await svgToCanvas(job.svg, mmToPx(symbolW, dpi), '#ffffff');
    const aspect = canvas.height / canvas.width;
    let symbolH = symbolW * aspect;

    // Never let a tall symbol overflow its label.
    const maxSymbolH = topLayout ? template.height * 0.62 : template.height - pad * 2;
    let drawW = symbolW;
    if (symbolH > maxSymbolH) {
      drawW = maxSymbolH / aspect;
      symbolH = maxSymbolH;
    }

    let symbolX: number;
    let symbolY: number;
    let textX: number;
    let textY: number;
    let textW: number;

    if (topLayout) {
      symbolX = x + (template.width - drawW) / 2;
      symbolY = y + pad;
      textX = x + pad;
      textY = symbolY + symbolH + 2.2;
      textW = template.width - pad * 2;
    } else if (template.symbolPosition === 'right') {
      symbolX = x + template.width - drawW - pad;
      symbolY = y + (template.height - symbolH) / 2;
      textX = x + pad;
      textW = template.width - drawW - pad * 3;
      textY = y + pad + 3;
    } else {
      symbolX = x + pad;
      symbolY = y + (template.height - symbolH) / 2;
      textX = x + drawW + pad * 2;
      textW = template.width - drawW - pad * 3;
      textY = y + pad + 3;
    }

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      symbolX,
      symbolY,
      drawW,
      symbolH,
      undefined,
      'FAST',
    );

    // --- Text block -----------------------------------------------------
    const visible = template.fields.filter((f) => f.show);
    let cursorY = textY;
    for (const field of visible) {
      const text = interpolate(field.value, job.row).trim();
      if (!text) continue;
      if (cursorY > y + template.height - pad * 0.5) break;

      pdf.setFont('helvetica', field.bold ? 'bold' : 'normal');
      pdf.setFontSize(field.size);
      pdf.setTextColor(20);

      // Wrap long product names instead of letting them run off the label.
      const lines = pdf.splitTextToSize(text, Math.max(5, textW)) as string[];
      for (const line of lines) {
        if (cursorY > y + template.height - pad * 0.5) break;
        const alignX =
          field.align === 'center'
            ? textX + textW / 2
            : field.align === 'right'
              ? textX + textW
              : textX;
        pdf.text(line, alignX, cursorY, { align: field.align, baseline: 'alphabetic' });
        cursorY += field.size * 0.42;
      }
      cursorY += 0.6;
    }

    onProgress?.(i + 1, jobs.length);
  }

  // --- Cut guides --------------------------------------------------------
  if (options.cropMarks) {
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
      pdf.setPage(p);
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.1);
      for (const pos of layout.positions) {
        const m = 2;
        // Horizontal ticks at the top and bottom edges of each label.
        pdf.line(pos.x, pos.y - m, pos.x, pos.y - 0.5);
        pdf.line(
          pos.x + template.width,
          pos.y + template.height + 0.5,
          pos.x + template.width,
          pos.y + template.height + m,
        );
      }
    }
  }

  return pdf.output('blob');
}

/**
 * Live HTML preview of one label. Mirrors the PDF geometry closely enough to
 * trust, while staying cheap to re-render on every keystroke.
 */
export function labelPreviewStyle(template: LabelTemplate, pxPerMm: number) {
  return {
    width: `${template.width * pxPerMm}px`,
    height: `${template.height * pxPerMm}px`,
  };
}

export function fieldDefaults(id: string): LabelField {
  return { id, label: 'New field', value: '', size: 8, bold: false, align: 'left', show: true };
}
