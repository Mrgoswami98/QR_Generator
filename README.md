# CodeForge — QR & Barcode Studio

A production-grade QR code and barcode generation studio for business and manufacturing use.
29 symbologies, styled QR codes, bulk generation from spreadsheets, and print-ready label sheets —
running entirely in the browser with no backend, no accounts, and no per-code limits.

---

## Why it's built this way

**No server.** Every symbol is generated in the browser. Product SKUs, customer spreadsheets and
logos never leave the user's machine. This is a genuine requirement in manufacturing, not a
nice-to-have — and it means hosting costs nothing and scales infinitely on static hosting.

**SVG first, raster second.** Every symbol is produced as SVG and rasterised on demand. A barcode
whose bar widths land on fractional pixels fails verification on real scanners, so the geometry is
resolution-independent by default. A 4000px PNG and a 120px thumbnail come from identical geometry.

**Millimetres, not pixels.** Barcode sizing uses the X-dimension (narrow bar width) and bar height
in millimetres, because that is how label stock is specified and how GS1 tolerances are written.

---

## Features

### QR Studio
- 12 payload types that make a scan *do* something: URL, Wi-Fi join, vCard contact, email, SMS,
  phone, WhatsApp, UPI payment, geo location, calendar event, plain text, and product/SKU records
- Custom module shapes (square, rounded, dots, classy, diamond) with neighbour-aware corner rounding
- Separately styled finder patterns ("eyes") — 4 shapes, independent frame and centre colours
- Linear and radial gradients with adjustable angle
- Centre logo with an excavated quiet area, adjustable size and corner radius
- Error correction L/M/Q/H with live capacity and version feedback
- Transparent backgrounds, configurable quiet zone

### Barcode Studio
29 symbologies grouped by industry, encoded via BWIPP (the reference implementation):

| Group | Symbologies |
|---|---|
| Retail & GS1 | EAN-13, EAN-8, UPC-A, UPC-E, GS1-128, GS1 DataBar Expanded |
| Logistics | ITF-14, Interleaved 2 of 5, SSCC-18, Code 128 |
| Industrial | Code 39, Code 39 Extended, Code 93, Code 11, MSI Plessey, Codabar |
| 2D | QR Code, Data Matrix, GS1 Data Matrix, PDF417, Aztec, MaxiCode, Micro QR |
| Healthcare | HIBC Code 128, Pharmacode |
| Postal | POSTNET, Royal Mail 4-State, Australia Post, Japan Post |

- Automatic modulo-10 check digit calculation for fixed-length numeric symbologies
- Live validation with messages written for operators, not developers
- X-dimension and bar height in mm, quiet zone control, 90° ladder rotation

### Bulk generation
- CSV, TSV and Excel (`.xlsx`, `.xls`) import with delimiter sniffing
- Values are kept as text, so leading zeros in SKUs survive the import
- `{{column}}` templating for both the encoded value and the output filename
- Live preview of the first 24 rows with per-row validation
- Exports a ZIP of all codes plus a CSV manifest mapping every file to its payload and status
- Handles up to 20,000 rows

### Label designer
- Label size, page margins and gutters in mm; A4, Letter, A5 and thermal roll stock
- Automatic imposition with a live page/label/sheet count
- Symbol on the left, right or top; adjustable symbol width
- Unlimited text fields with `{{column}}` placeholders, per-field size, weight and alignment
- Print-ready PDF at 203 / 300 / 600 DPI, with optional cut guides
- Multiple copies per row

### Scanner
Verify a code before a production run using the browser's native `BarcodeDetector` — scan from the
camera or from an image file, then open, copy or inspect the decoded payload.

### Throughout
- History stored in IndexedDB with search, favourites, reuse and JSON export
- PNG, JPG, SVG and PDF export; copy to clipboard; direct print
- Light and dark themes, responsive from phone to desktop
- Works offline once loaded

---

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type check + production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # types only
```

---

## Deploying

### GitHub Pages (zero configuration)

1. Push this repository to GitHub.
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`.

`.github/workflows/deploy.yml` type-checks, builds and publishes automatically. It detects whether
the repo is a project site (`/<repo>/`) or a user site (`<user>.github.io`, served from `/`) and
sets the asset base path accordingly — the single most common cause of a blank page on Pages.

Routing uses a **hash router** (`/#/labels`) on purpose. GitHub Pages serves static files with no
rewrite rules, so a browser router would 404 on refresh for any deep link. Hash routing makes every
route shareable and refresh-safe on any static host, with no `404.html` redirect hack.

### Anywhere else

The build output in `dist/` is plain static files. Netlify, Vercel, Cloudflare Pages, S3, nginx or
any file server will serve it as-is:

```bash
BASE_PATH="/" npm run build
```

Set `BASE_PATH` to the subdirectory if the app is not served from the domain root.

---

## Architecture

```
src/
├── lib/                  Framework-free engine — no React imports
│   ├── types.ts          Shared domain types
│   ├── qr.ts             Custom QR renderer (module matrix → styled SVG)
│   ├── barcode.ts        BWIPP wrapper, mm→scale conversion, error translation
│   ├── symbologies.ts    Symbology catalogue, validation, check digits
│   ├── payloads.ts       Wi-Fi / vCard / UPI / iCal payload builders
│   ├── labels.ts         Label composition and PDF imposition
│   ├── export.ts         SVG → PNG/JPG/PDF/ZIP pipeline
│   ├── importer.ts       CSV / Excel parsing
│   └── history.ts        IndexedDB persistence
├── components/           Reusable UI primitives and shell
├── pages/                One file per route, lazily loaded
└── store.ts              Theme, toasts, history cache (Zustand)
```

The `lib/` layer has no React dependency, so the engine is testable in Node and reusable in a
worker or a CLI. Each page lazily imports its own heavy engine (`bwip-js`, `jspdf`, `xlsx`), which
keeps the dashboard's first paint small.

### How the QR renderer works

`qrcode` is used only to compute the module matrix. The matrix is then drawn as SVG paths, which is
what makes the styling possible — stock renderers emit fixed black squares. Finder patterns are
excluded from the data loop and drawn separately so they can carry their own shape and colour, and
rounded modules inspect their four neighbours so runs merge into one smooth stroke rather than a
string of separate blobs.

The geometry is verified against the encoder: every dark module in the matrix produces exactly one
drawn module, and the quiet zone matches the declared margin.

---

## Scanning reliability

A few constraints are enforced or surfaced in the UI because getting them wrong produces codes that
look correct and fail in the field:

- **Quiet zone.** The QR specification requires 4 modules of clear space. The app will not go below 1.
- **Logos.** A logo covers data modules. Use error correction `H` and test the printed result.
- **Colour.** Scanners read contrast, not colour. Red bars are invisible to most red-laser scanners.
- **X-dimension.** GS1 retail codes require at least 0.264 mm. Below roughly 0.25 mm most thermal
  printers cannot hold the tolerance.
- **Print scaling.** Print at 100%. Any "fit to page" setting shrinks the bars out of specification.

---

## Browser support

Generation, export and printing work in all current browsers. The **Scanner** uses the native
`BarcodeDetector` API, available in Chromium-based browsers on desktop and Android; the page says so
plainly where it is unavailable rather than failing silently. Clipboard *image* copy is unavailable
in Firefox, which falls back to a download.

---

## Licence

MIT — see [LICENSE](LICENSE).

Barcode encoding is provided by [bwip-js](https://github.com/metafloor/bwip-js), a JavaScript port
of [BWIPP](https://github.com/bwipp/postscriptbarcode) (MIT).
