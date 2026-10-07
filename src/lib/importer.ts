import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Tabular import for bulk generation.
 *
 * Accepts CSV, TSV and Excel workbooks and normalises all of them into the
 * same shape: a header list plus string rows. Values are kept as strings
 * because barcode payloads are text — letting a spreadsheet coerce
 * `0012345` into the number 12345 silently destroys the code.
 */

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** Non-fatal problems worth showing the user. */
  warnings: string[];
}

const MAX_ROWS = 20000;

function normaliseHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = String(h ?? '').trim() || `Column ${i + 1}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name} (${count + 1})`;
    return name;
  });
}

function toStringCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
    return parseWorkbook(file);
  }
  return parseDelimited(file);
}

async function parseWorkbook(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  // `raw: false` + `cellText` keeps leading zeros and formatted values intact.
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('That workbook has no sheets.');

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });

  if (matrix.length === 0) throw new Error('The first sheet is empty.');

  const headers = normaliseHeaders(matrix[0]);
  const warnings: string[] = [];
  if (wb.SheetNames.length > 1) {
    warnings.push(`Imported the first sheet ("${sheetName}"). ${wb.SheetNames.length - 1} other sheet(s) were skipped.`);
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length && rows.length < MAX_ROWS; i += 1) {
    const row = matrix[i];
    if (!row || row.every((c) => toStringCell(c) === '')) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, c) => {
      record[h] = toStringCell(row[c]);
    });
    rows.push(record);
  }

  if (matrix.length - 1 > MAX_ROWS) {
    warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows were imported.`);
  }

  return { headers, rows, warnings };
}

function parseDelimited(file: File): Promise<ParsedTable> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      // Let Papa sniff , ; tab and pipe rather than assuming a comma.
      delimitersToGuess: [',', ';', '\t', '|'],
      transformHeader: (h, i) => String(h ?? '').trim() || `Column ${i + 1}`,
      complete: (result) => {
        const headers = normaliseHeaders(result.meta.fields ?? []);
        if (headers.length === 0) {
          reject(new Error('No header row was found. The first row must contain column names.'));
          return;
        }

        const warnings: string[] = [];
        const rows = result.data
          .slice(0, MAX_ROWS)
          .map((r) => {
            const record: Record<string, string> = {};
            for (const h of headers) record[h] = toStringCell(r[h]);
            return record;
          })
          .filter((r) => Object.values(r).some((v) => v !== ''));

        if (result.errors.length > 0) {
          const first = result.errors[0];
          warnings.push(
            `${result.errors.length} row(s) could not be read cleanly. First problem: ${first.message} (row ${(first.row ?? 0) + 2}).`,
          );
        }
        if (result.data.length > MAX_ROWS) {
          warnings.push(`Only the first ${MAX_ROWS.toLocaleString()} rows were imported.`);
        }
        if (rows.length === 0) {
          reject(new Error('The file has headers but no data rows.'));
          return;
        }

        resolve({ headers, rows, warnings });
      },
      error: (err) => reject(new Error(`Could not read the file: ${err.message}`)),
    });
  });
}

/** Builds a small sample CSV so users can see the expected shape. */
export function sampleCsv(): string {
  const rows = [
    ['sku', 'name', 'batch', 'mrp', 'url'],
    ['SKU-48120-A', 'M8 Hex Bolt — Zinc', 'B-2026-04', '249.00', 'https://example.com/p/48120'],
    ['SKU-48121-A', 'M10 Hex Bolt — Zinc', 'B-2026-04', '289.00', 'https://example.com/p/48121'],
    ['SKU-51002-B', 'Nylon Washer 12mm', 'B-2026-05', '45.00', 'https://example.com/p/51002'],
  ];
  return rows.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
}

/** Exports the generated set as a CSV manifest alongside the images. */
export function buildManifestCsv(
  rows: { filename: string; payload: string; status: string }[],
): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['filename,payload,status'];
  for (const r of rows) lines.push([r.filename, r.payload, r.status].map(esc).join(','));
  return lines.join('\n');
}
