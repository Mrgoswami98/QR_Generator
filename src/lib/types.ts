/** Shared domain types for the whole studio. */

export type CodeKind = 'qr' | 'barcode';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';

/** QR module (dot) shapes. */
export type DotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'diamond';

/** Shape used for the three large finder patterns ("eyes"). */
export type EyeStyle = 'square' | 'rounded' | 'circle' | 'leaf';

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export interface Gradient {
  enabled: boolean;
  type: 'linear' | 'radial';
  /** Degrees, only meaningful for linear gradients. */
  rotation: number;
  from: string;
  to: string;
}

export interface QrLogo {
  /** Data URL of the uploaded image. */
  src: string | null;
  /** Logo width as a fraction of the symbol width (0.1 – 0.3). */
  scale: number;
  /** Clear a quiet area behind the logo so scanners are not confused. */
  excavate: boolean;
  /** Corner radius of the logo backdrop in px. */
  radius: number;
}

export interface QrOptions {
  data: string;
  ecc: EccLevel;
  /** Rendered edge length in px (excluding nothing — this is the final bitmap size). */
  size: number;
  /** Quiet zone in modules. The spec requires 4; we never go below 1. */
  margin: number;
  foreground: string;
  background: string;
  /** `true` keeps the background transparent (PNG/SVG only). */
  transparent: boolean;
  gradient: Gradient;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  /** Null means "inherit from the module colour". */
  eyeColor: string | null;
  eyeBallColor: string | null;
  logo: QrLogo;
}

export interface BarcodeOptions {
  /** bwip-js symbology id, e.g. `code128`, `ean13`, `datamatrix`. */
  symbology: string;
  data: string;
  /** Narrow-bar width in mm — the classic "X dimension". */
  scaleX: number;
  /** Bar height in mm. */
  height: number;
  includeText: boolean;
  textSize: number;
  foreground: string;
  background: string;
  transparent: boolean;
  /** Quiet zone in mm, applied on every side. */
  margin: number;
  /** Add the EAN/UPC check digit automatically where the symbology supports it. */
  addChecksum: boolean;
  /** Render at 90° — useful for "ladder" orientation on narrow labels. */
  rotate: boolean;
}

export interface Symbology {
  id: string;
  name: string;
  group: 'Retail & GS1' | 'Logistics' | 'Industrial' | '2D' | 'Postal' | 'Healthcare';
  /** Human description shown under the picker. */
  hint: string;
  /** Example value that always encodes cleanly. */
  sample: string;
  /** Fixed-length requirement, if any (digits only). */
  fixedLength?: number;
  /** Validation regex applied to the raw user input. */
  pattern?: RegExp;
  /** Message shown when `pattern` fails. */
  patternHint?: string;
  /** Symbol is two-dimensional: height/text options do not apply the same way. */
  twoD?: boolean;
}

/** Everything needed to re-create one generated symbol. */
export interface HistoryEntry {
  id: string;
  kind: CodeKind;
  /** Short human label shown in the list. */
  title: string;
  /** The encoded payload. */
  data: string;
  /** Payload template used, e.g. `url`, `vcard`, `wifi`. */
  template?: string;
  createdAt: number;
  /** Serialized option object so the entry can be reopened exactly as generated. */
  options: QrOptions | BarcodeOptions;
  /** Small PNG data URL for the list thumbnail. */
  thumbnail: string;
  favorite: boolean;
  tags: string[];
}

export interface LabelField {
  id: string;
  /** Column key from the imported data, or a literal string. */
  label: string;
  value: string;
  size: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  show: boolean;
}

export interface LabelTemplate {
  id: string;
  name: string;
  /** Physical label size in mm. */
  width: number;
  height: number;
  /** Page margins in mm. */
  marginX: number;
  marginY: number;
  /** Gap between labels in mm. */
  gutterX: number;
  gutterY: number;
  /** Where the symbol sits relative to the text block. */
  symbolPosition: 'left' | 'right' | 'top';
  /** Symbol width as a fraction of label width. */
  symbolScale: number;
  showBorder: boolean;
  fields: LabelField[];
}

export interface BulkRow {
  /** Original row index for error reporting. */
  index: number;
  data: Record<string, string>;
  /** Resolved payload after template substitution. */
  payload: string;
  error: string | null;
}
