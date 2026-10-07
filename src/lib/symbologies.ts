import type { Symbology } from './types';

/**
 * Curated symbology catalogue.
 *
 * Every entry maps to a bwip-js (BWIPP) encoder id. We deliberately expose a
 * business-relevant subset rather than all ~100 BWIPP encoders — the long tail
 * is mostly regional postal variants that create more confusion than value.
 */
export const SYMBOLOGIES: Symbology[] = [
  // ---------- Retail & GS1 ----------
  {
    id: 'ean13',
    name: 'EAN-13',
    group: 'Retail & GS1',
    hint: 'Global retail standard. 12 digits + 1 check digit.',
    sample: '5901234123457',
    fixedLength: 13,
    pattern: /^\d{12,13}$/,
    patternHint: 'Enter 12 digits (check digit added automatically) or all 13.',
  },
  {
    id: 'ean8',
    name: 'EAN-8',
    group: 'Retail & GS1',
    hint: 'Compact retail code for small packaging.',
    sample: '96385074',
    fixedLength: 8,
    pattern: /^\d{7,8}$/,
    patternHint: 'Enter 7 or 8 digits.',
  },
  {
    id: 'upca',
    name: 'UPC-A',
    group: 'Retail & GS1',
    hint: 'North American retail standard. 11 digits + check digit.',
    sample: '036000291452',
    fixedLength: 12,
    pattern: /^\d{11,12}$/,
    patternHint: 'Enter 11 or 12 digits.',
  },
  {
    id: 'upce',
    name: 'UPC-E',
    group: 'Retail & GS1',
    hint: 'Zero-suppressed UPC for very small products.',
    sample: '04252614',
    pattern: /^\d{7,8}$/,
    patternHint: 'Enter 7 or 8 digits.',
  },
  {
    id: 'gs1-128',
    name: 'GS1-128',
    group: 'Retail & GS1',
    hint: 'Application Identifiers in brackets, e.g. (01)(17)(10).',
    sample: '(01)09501101020917(17)300101(10)A1B2C3',
    pattern: /^\(\d{2,4}\).+/,
    patternHint: 'Must start with an Application Identifier such as (01).',
  },
  {
    id: 'databarexpanded',
    name: 'GS1 DataBar Expanded',
    group: 'Retail & GS1',
    hint: 'Variable-measure retail items such as fresh produce.',
    sample: '(01)90012345678908(3103)001750',
    pattern: /^\(\d{2,4}\).+/,
    patternHint: 'Must start with an Application Identifier such as (01).',
  },

  // ---------- Logistics ----------
  {
    id: 'itf14',
    name: 'ITF-14',
    group: 'Logistics',
    hint: 'Shipping container / outer-carton code. 13 digits + check digit.',
    sample: '15400141288763',
    fixedLength: 14,
    pattern: /^\d{13,14}$/,
    patternHint: 'Enter 13 or 14 digits.',
  },
  {
    id: 'interleaved2of5',
    name: 'Interleaved 2 of 5',
    group: 'Logistics',
    hint: 'Dense numeric code used in warehousing. Even digit count.',
    sample: '12345670',
    pattern: /^\d+$/,
    patternHint: 'Digits only.',
  },
  {
    id: 'sscc18',
    name: 'SSCC-18',
    group: 'Logistics',
    hint: 'Serial Shipping Container Code for pallets. Uses the (00) identifier.',
    sample: '(00)106141411234567897',
    pattern: /^\(00\)\d{17,18}$/,
    patternHint: 'Format: (00) followed by 17 or 18 digits.',
  },
  {
    id: 'code128',
    name: 'Code 128',
    group: 'Logistics',
    hint: 'The workhorse: full ASCII, variable length, very compact.',
    sample: 'SKU-48120-A',
  },

  // ---------- Industrial ----------
  {
    id: 'code39',
    name: 'Code 39',
    group: 'Industrial',
    hint: 'Legacy industrial standard. A–Z, 0–9 and - . $ / + % space.',
    sample: 'PART-1024',
    pattern: /^[0-9A-Z\-. $/+%]*$/,
    patternHint: 'Only A–Z, 0–9 and the symbols - . $ / + % and space.',
  },
  {
    id: 'code39ext',
    name: 'Code 39 Extended',
    group: 'Industrial',
    hint: 'Code 39 with full ASCII support via shift characters.',
    sample: 'Part/rev-A',
  },
  {
    id: 'code93',
    name: 'Code 93',
    group: 'Industrial',
    hint: 'Denser successor to Code 39 with stronger error checking.',
    sample: 'ASSY-7781',
  },
  {
    id: 'code11',
    name: 'Code 11',
    group: 'Industrial',
    hint: 'Telecom equipment labelling. Digits and dash.',
    sample: '9212346',
    pattern: /^[\d-]+$/,
    patternHint: 'Digits and dashes only.',
  },
  {
    id: 'msi',
    name: 'MSI Plessey',
    group: 'Industrial',
    hint: 'Inventory and shelf labelling in retail warehouses.',
    sample: '80523',
    pattern: /^\d+$/,
    patternHint: 'Digits only.',
  },
  {
    id: 'rationalizedCodabar',
    name: 'Codabar',
    group: 'Industrial',
    hint: 'Libraries, blood banks and photo labs. Starts/ends A–D.',
    sample: 'A40156B',
    pattern: /^[A-Da-d][\d\-$:/.+]*[A-Da-d]$/,
    patternHint: 'Must start and end with a letter A–D.',
  },

  // ---------- 2D ----------
  {
    id: 'qrcode',
    name: 'QR Code',
    group: '2D',
    hint: 'High capacity, omnidirectional, universally scannable.',
    sample: 'https://example.com',
    twoD: true,
  },
  {
    id: 'datamatrix',
    name: 'Data Matrix',
    group: '2D',
    hint: 'Tiny footprint — the standard for direct part marking.',
    sample: 'DPM-0099-X',
    twoD: true,
  },
  {
    id: 'gs1datamatrix',
    name: 'GS1 Data Matrix',
    group: '2D',
    hint: 'Data Matrix carrying GS1 Application Identifiers.',
    sample: '(01)09501101020917(17)300101(10)A1B2C3',
    pattern: /^\(\d{2,4}\).+/,
    patternHint: 'Must start with an Application Identifier such as (01).',
    twoD: true,
  },
  {
    id: 'pdf417',
    name: 'PDF417',
    group: '2D',
    hint: 'Stacked linear symbol. ID cards, shipping, boarding passes.',
    sample: 'PDF417 carries up to 1.8 kB of data',
    twoD: true,
  },
  {
    id: 'azteccode',
    name: 'Aztec Code',
    group: '2D',
    hint: 'No quiet zone required — ideal for tickets on screens.',
    sample: 'TICKET-55021',
    twoD: true,
  },
  {
    id: 'maxicode',
    name: 'MaxiCode',
    group: '2D',
    hint: 'Fixed-size courier symbol used by UPS.',
    sample: 'MaxiCode payload',
    twoD: true,
  },
  {
    id: 'microqrcode',
    name: 'Micro QR',
    group: '2D',
    hint: 'Miniature QR for very small parts. Low capacity.',
    sample: '12345',
    twoD: true,
  },

  // ---------- Healthcare ----------
  {
    id: 'hibccode128',
    name: 'HIBC Code 128',
    group: 'Healthcare',
    hint: 'Health Industry Bar Code supplier labelling.',
    sample: 'A123BJC5D6E71',
  },
  {
    id: 'pharmacode',
    name: 'Pharmacode',
    group: 'Healthcare',
    hint: 'Pharmaceutical packaging control code. 3–131070.',
    sample: '117480',
    pattern: /^\d+$/,
    patternHint: 'A number between 3 and 131070.',
  },

  // ---------- Postal ----------
  {
    id: 'postnet',
    name: 'POSTNET',
    group: 'Postal',
    hint: 'US Postal Service routing code.',
    sample: '12345',
    pattern: /^\d{5}(\d{4})?(\d{2})?$/,
    patternHint: 'Enter 5, 9 or 11 digits.',
  },
  {
    id: 'royalmail',
    name: 'Royal Mail 4-State',
    group: 'Postal',
    hint: 'UK postal routing (RM4SCC).',
    sample: 'LE28HS9Z',
  },
  {
    id: 'auspost',
    name: 'Australia Post',
    group: 'Postal',
    hint: 'Australia Post 4-state customer barcode.',
    sample: '5956439111ABA 9',
  },
  {
    id: 'japanpost',
    name: 'Japan Post',
    group: 'Postal',
    hint: 'Japan Post 4-state customer code.',
    sample: '1310021-3-2-503',
  },
];

export const SYMBOLOGY_GROUPS = [
  'Retail & GS1',
  'Logistics',
  'Industrial',
  '2D',
  'Healthcare',
  'Postal',
] as const;

const BY_ID = new Map(SYMBOLOGIES.map((s) => [s.id, s]));

export function getSymbology(id: string): Symbology {
  return BY_ID.get(id) ?? SYMBOLOGIES.find((s) => s.id === 'code128')!;
}

/**
 * Validates raw input for a symbology before we hand it to the encoder.
 * Returns `null` when the value is acceptable, otherwise a human message.
 *
 * This is a fast pre-check for instant feedback; bwip-js remains the final
 * authority and its errors are surfaced too.
 */
export function validateForSymbology(id: string, value: string): string | null {
  const sym = getSymbology(id);
  if (!value.trim()) return 'Enter a value to encode.';

  if (sym.pattern && !sym.pattern.test(value)) {
    return sym.patternHint ?? `Value is not valid for ${sym.name}.`;
  }

  if (sym.id === 'interleaved2of5' && value.length % 2 !== 0) {
    return 'Interleaved 2 of 5 needs an even number of digits.';
  }

  if (sym.id === 'pharmacode') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 3 || n > 131070) {
      return 'Pharmacode must be a number between 3 and 131070.';
    }
  }

  if (sym.id === 'microqrcode' && value.length > 35) {
    return 'Micro QR holds at most 35 characters. Use a standard QR code instead.';
  }

  return null;
}

/**
 * Compute the GS1/EAN modulo-10 check digit for a numeric body.
 * Weights alternate 3,1 starting from the rightmost body digit.
 */
export function mod10CheckDigit(body: string): string {
  let sum = 0;
  for (let i = body.length - 1, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3) {
    sum += Number(body[i]) * weight;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Appends a check digit when the user supplied the short form of a
 * fixed-length numeric symbology (EAN-13, EAN-8, UPC-A, ITF-14, SSCC-18).
 */
export function withCheckDigit(id: string, value: string): string {
  const sym = getSymbology(id);
  if (!sym.fixedLength || !/^\d+$/.test(value)) return value;
  if (value.length !== sym.fixedLength - 1) return value;
  return value + mod10CheckDigit(value);
}
