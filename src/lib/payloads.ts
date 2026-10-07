/**
 * Payload builders.
 *
 * A QR code is just a string — what makes it "open the right thing" when
 * scanned is encoding that string in the format phones recognise. These
 * builders produce those well-known formats so a scan launches the dialler,
 * the mail app, the Wi-Fi join sheet, the contact card and so on.
 */

export type TemplateId =
  | 'url'
  | 'text'
  | 'product'
  | 'wifi'
  | 'vcard'
  | 'email'
  | 'sms'
  | 'phone'
  | 'geo'
  | 'event'
  | 'whatsapp'
  | 'upi';

export interface TemplateField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  /** One-line description of what happens when the code is scanned. */
  scanResult: string;
  fields: TemplateField[];
  build(values: Record<string, string>): string;
}

/** Escapes the reserved characters in the Wi-Fi payload grammar. */
function escWifi(v: string): string {
  return v.replace(/([\\;,":])/g, '\\$1');
}

/** Escapes the reserved characters in vCard property values. */
function escVCard(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

/** `YYYY-MM-DD` + `HH:MM` to the basic iCalendar UTC form. */
function icalDate(date: string, time: string): string {
  if (!date) return '';
  const dt = new Date(`${date}T${time || '00:00'}:00`);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function nonEmpty(...lines: (string | false | undefined)[]): string {
  return lines.filter((l): l is string => Boolean(l)).join('\n');
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'url',
    name: 'Website / Link',
    scanResult: 'Opens the link in the browser.',
    fields: [
      {
        key: 'url',
        label: 'URL',
        placeholder: 'https://your-company.com/product/48120',
        required: true,
        help: 'Include https:// so every scanner treats it as a link.',
      },
    ],
    build: (v) => {
      const url = (v.url ?? '').trim();
      if (!url) return '';
      // A bare domain still has to be a valid URI or phones show plain text.
      return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    },
  },
  {
    id: 'text',
    name: 'Plain Text',
    scanResult: 'Displays the text on screen.',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea', placeholder: 'Any text…', required: true },
    ],
    build: (v) => (v.text ?? '').trim(),
  },
  {
    id: 'product',
    name: 'Product / SKU',
    scanResult: 'Opens the product page, or shows the product details.',
    fields: [
      { key: 'sku', label: 'SKU', placeholder: 'SKU-48120-A', required: true },
      { key: 'name', label: 'Product name', placeholder: 'M8 Hex Bolt — Zinc' },
      { key: 'batch', label: 'Batch / Lot', placeholder: 'B-2026-04' },
      { key: 'serial', label: 'Serial number', placeholder: 'SN-000124' },
      { key: 'mrp', label: 'MRP / Price', placeholder: '249.00' },
      {
        key: 'url',
        label: 'Product URL',
        placeholder: 'https://your-company.com/p/48120',
        help: 'If set, the scan opens this page and the other fields ride along as query parameters.',
      },
    ],
    build: (v) => {
      const sku = (v.sku ?? '').trim();
      if (!sku) return '';
      const url = (v.url ?? '').trim();
      if (url) {
        const base = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
        try {
          const u = new URL(base);
          u.searchParams.set('sku', sku);
          if (v.batch) u.searchParams.set('batch', v.batch);
          if (v.serial) u.searchParams.set('sn', v.serial);
          return u.toString();
        } catch {
          return base;
        }
      }
      // No URL: emit a compact, human-readable record.
      return nonEmpty(
        v.name && `Product: ${v.name}`,
        `SKU: ${sku}`,
        v.batch && `Batch: ${v.batch}`,
        v.serial && `Serial: ${v.serial}`,
        v.mrp && `MRP: ${v.mrp}`,
      );
    },
  },
  {
    id: 'wifi',
    name: 'Wi-Fi Network',
    scanResult: 'Prompts the phone to join the network.',
    fields: [
      { key: 'ssid', label: 'Network name (SSID)', required: true, placeholder: 'Factory-Floor' },
      { key: 'password', label: 'Password', placeholder: '••••••••' },
      {
        key: 'encryption',
        label: 'Security',
        type: 'select',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'Open (no password)' },
        ],
      },
      { key: 'hidden', label: 'Hidden network', type: 'checkbox' },
    ],
    build: (v) => {
      const ssid = (v.ssid ?? '').trim();
      if (!ssid) return '';
      const enc = v.encryption || 'WPA';
      const parts = [`S:${escWifi(ssid)}`, `T:${enc}`];
      if (enc !== 'nopass' && v.password) parts.push(`P:${escWifi(v.password)}`);
      if (v.hidden === 'true') parts.push('H:true');
      return `WIFI:${parts.join(';')};;`;
    },
  },
  {
    id: 'vcard',
    name: 'Contact Card',
    scanResult: 'Offers to save the contact to the address book.',
    fields: [
      { key: 'firstName', label: 'First name', required: true, placeholder: 'Asha' },
      { key: 'lastName', label: 'Last name', placeholder: 'Mehta' },
      { key: 'org', label: 'Company', placeholder: 'Oakcraft Industries' },
      { key: 'title', label: 'Job title', placeholder: 'Production Manager' },
      { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
      { key: 'email', label: 'Email', placeholder: 'asha@example.com' },
      { key: 'website', label: 'Website', placeholder: 'https://example.com' },
      { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, City, State, ZIP' },
    ],
    build: (v) => {
      const first = (v.firstName ?? '').trim();
      const last = (v.lastName ?? '').trim();
      if (!first && !last) return '';
      return nonEmpty(
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escVCard(last)};${escVCard(first)};;;`,
        `FN:${escVCard([first, last].filter(Boolean).join(' '))}`,
        v.org && `ORG:${escVCard(v.org)}`,
        v.title && `TITLE:${escVCard(v.title)}`,
        v.phone && `TEL;TYPE=CELL:${v.phone.trim()}`,
        v.email && `EMAIL;TYPE=INTERNET:${v.email.trim()}`,
        v.website && `URL:${v.website.trim()}`,
        v.address && `ADR;TYPE=WORK:;;${escVCard(v.address.replace(/\n/g, ', '))}`,
        'END:VCARD',
      );
    },
  },
  {
    id: 'email',
    name: 'Email',
    scanResult: 'Opens a pre-filled email draft.',
    fields: [
      { key: 'to', label: 'To', required: true, placeholder: 'sales@example.com' },
      { key: 'subject', label: 'Subject', placeholder: 'Quote request' },
      { key: 'body', label: 'Message', type: 'textarea' },
    ],
    build: (v) => {
      const to = (v.to ?? '').trim();
      if (!to) return '';
      const q = new URLSearchParams();
      if (v.subject) q.set('subject', v.subject);
      if (v.body) q.set('body', v.body);
      const qs = q.toString();
      return `mailto:${to}${qs ? `?${qs}` : ''}`;
    },
  },
  {
    id: 'sms',
    name: 'SMS',
    scanResult: 'Opens a pre-filled text message.',
    fields: [
      { key: 'phone', label: 'Phone number', required: true, placeholder: '+919876543210' },
      { key: 'message', label: 'Message', type: 'textarea' },
    ],
    build: (v) => {
      const phone = (v.phone ?? '').replace(/\s/g, '');
      if (!phone) return '';
      return v.message ? `SMSTO:${phone}:${v.message}` : `SMSTO:${phone}:`;
    },
  },
  {
    id: 'phone',
    name: 'Phone Call',
    scanResult: 'Opens the dialler with the number ready.',
    fields: [{ key: 'phone', label: 'Phone number', required: true, placeholder: '+919876543210' }],
    build: (v) => {
      const phone = (v.phone ?? '').replace(/\s/g, '');
      return phone ? `tel:${phone}` : '';
    },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    scanResult: 'Opens a WhatsApp chat with your message ready to send.',
    fields: [
      {
        key: 'phone',
        label: 'Phone number with country code',
        required: true,
        placeholder: '919876543210',
        help: 'Digits only, no + or spaces.',
      },
      { key: 'message', label: 'Pre-filled message', type: 'textarea' },
    ],
    build: (v) => {
      const phone = (v.phone ?? '').replace(/\D/g, '');
      if (!phone) return '';
      return `https://wa.me/${phone}${v.message ? `?text=${encodeURIComponent(v.message)}` : ''}`;
    },
  },
  {
    id: 'upi',
    name: 'UPI Payment',
    scanResult: 'Opens a UPI app with the payment pre-filled.',
    fields: [
      { key: 'vpa', label: 'UPI ID', required: true, placeholder: 'business@okaxis' },
      { key: 'name', label: 'Payee name', placeholder: 'Oakcraft Industries' },
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '499.00' },
      { key: 'note', label: 'Note', placeholder: 'Invoice 2026-114' },
    ],
    build: (v) => {
      const vpa = (v.vpa ?? '').trim();
      if (!vpa) return '';
      const q = new URLSearchParams({ pa: vpa });
      if (v.name) q.set('pn', v.name);
      if (v.amount) q.set('am', v.amount);
      if (v.note) q.set('tn', v.note);
      q.set('cu', 'INR');
      return `upi://pay?${q.toString()}`;
    },
  },
  {
    id: 'geo',
    name: 'Location',
    scanResult: 'Opens the coordinates in the maps app.',
    fields: [
      { key: 'lat', label: 'Latitude', required: true, placeholder: '19.0760' },
      { key: 'lng', label: 'Longitude', required: true, placeholder: '72.8777' },
      { key: 'label', label: 'Place name', placeholder: 'Warehouse A' },
    ],
    build: (v) => {
      const lat = (v.lat ?? '').trim();
      const lng = (v.lng ?? '').trim();
      if (!lat || !lng) return '';
      return `geo:${lat},${lng}${v.label ? `?q=${encodeURIComponent(v.label)}` : ''}`;
    },
  },
  {
    id: 'event',
    name: 'Calendar Event',
    scanResult: 'Offers to add the event to the calendar.',
    fields: [
      { key: 'title', label: 'Event title', required: true, placeholder: 'Quality audit' },
      { key: 'location', label: 'Location', placeholder: 'Plant 2, Line B' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'startTime', label: 'Start time', placeholder: '09:00' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'endTime', label: 'End time', placeholder: '17:00' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    build: (v) => {
      const title = (v.title ?? '').trim();
      if (!title) return '';
      return nonEmpty(
        'BEGIN:VEVENT',
        `SUMMARY:${escVCard(title)}`,
        v.location && `LOCATION:${escVCard(v.location)}`,
        v.description && `DESCRIPTION:${escVCard(v.description)}`,
        v.startDate && `DTSTART:${icalDate(v.startDate, v.startTime)}`,
        v.endDate && `DTEND:${icalDate(v.endDate, v.endTime)}`,
        'END:VEVENT',
      );
    },
  },
];

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATE_BY_ID.get(id) ?? TEMPLATES[0];
}

/** Short label used in the history list and bulk exports. */
export function summarisePayload(data: string): string {
  if (!data) return 'Empty';
  if (data.startsWith('BEGIN:VCARD')) {
    return `Contact · ${/FN:(.+)/.exec(data)?.[1]?.trim() ?? 'card'}`;
  }
  if (data.startsWith('BEGIN:VEVENT')) {
    return `Event · ${/SUMMARY:(.+)/.exec(data)?.[1]?.trim() ?? 'event'}`;
  }
  if (data.startsWith('WIFI:')) {
    return `Wi-Fi · ${/S:((?:\\.|[^;])*)/.exec(data)?.[1]?.replace(/\\(.)/g, '$1') ?? 'network'}`;
  }
  if (data.startsWith('mailto:')) return `Email · ${data.slice(7).split('?')[0]}`;
  if (data.startsWith('tel:')) return `Call · ${data.slice(4)}`;
  if (data.startsWith('SMSTO:')) return `SMS · ${data.split(':')[1]}`;
  if (data.startsWith('upi://')) return 'UPI payment';
  if (data.startsWith('geo:')) return `Location · ${data.slice(4).split('?')[0]}`;
  const flat = data.replace(/\s+/g, ' ').trim();
  return flat.length > 48 ? `${flat.slice(0, 48)}…` : flat;
}
