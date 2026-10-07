import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Barcode,
  Layers,
  Tags,
  ScanLine,
  ArrowRight,
  ShieldCheck,
  Zap,
  WifiOff,
} from 'lucide-react';
import { SYMBOLOGIES } from '../lib/symbologies';
import { TEMPLATES } from '../lib/payloads';
import { useApp } from '../store';
import { Stat, Panel } from '../components/ui';

const ACTIONS = [
  {
    to: '/qr',
    icon: QrCode,
    title: 'QR Studio',
    body: 'Styled QR codes with gradients, custom module shapes and a centre logo.',
  },
  {
    to: '/barcode',
    icon: Barcode,
    title: 'Barcode Studio',
    body: 'Retail, logistics, industrial and healthcare symbologies, sized in millimetres.',
  },
  {
    to: '/bulk',
    icon: Layers,
    title: 'Bulk Generate',
    body: 'Import a CSV or Excel file and export thousands of codes as a ZIP.',
  },
  {
    to: '/labels',
    icon: Tags,
    title: 'Label Designer',
    body: 'Compose product labels and export a print-ready, imposed PDF sheet.',
  },
];

export default function Dashboard() {
  const { history, historyLoaded, loadHistory } = useApp();

  useEffect(() => {
    if (!historyLoaded) void loadHistory();
  }, [historyLoaded, loadHistory]);

  const recent = useMemo(() => history.slice(0, 5), [history]);
  const qrCount = history.filter((h) => h.kind === 'qr').length;

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* ---- Hero ---- */}
      <section className="panel mb-5 overflow-hidden">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '18px 18px',
            }}
            aria-hidden="true"
          />
          <div className="relative max-w-2xl">
            <span className="chip mb-4 bg-brand-600/12 text-brand-500">
              <Zap className="h-3.5 w-3.5" />
              Runs entirely in your browser
            </span>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">
              Professional QR &amp; barcode generation,
              <br className="hidden sm:block" /> built for production work.
            </h1>
            <p className="muted mt-3 max-w-xl text-[14px] leading-relaxed">
              {SYMBOLOGIES.length} symbologies, {TEMPLATES.length} smart QR payload types, bulk
              generation from spreadsheets and print-ready label sheets — with no account, no upload
              and no per-code limit.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link to="/qr" className="btn-primary">
                <QrCode className="h-4 w-4" />
                Create a QR code
              </Link>
              <Link to="/barcode" className="btn-ghost">
                <Barcode className="h-4 w-4" />
                Create a barcode
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Stats ---- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Symbologies" value={SYMBOLOGIES.length} sub="Linear, 2D, postal, GS1" />
        <Stat label="QR payload types" value={TEMPLATES.length} sub="Wi-Fi, vCard, UPI and more" />
        <Stat label="Saved codes" value={history.length} sub={`${qrCount} QR · ${history.length - qrCount} barcode`} />
        <Stat label="Export formats" value={4} sub="PNG · JPG · SVG · PDF" />
      </div>

      {/* ---- Actions ---- */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {ACTIONS.map(({ to, icon: Icon, title, body }) => (
          <Link
            key={to}
            to={to}
            className="panel group flex gap-4 p-4 transition hover:shadow-lift"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600/12 text-brand-500 transition group-hover:bg-brand-600 group-hover:text-white">
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold">
                {title}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-60" />
              </span>
              <span className="muted mt-1 block text-[12.5px] leading-relaxed">{body}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- Recent ---- */}
        <Panel
          title="Recent codes"
          action={
            history.length > 0 ? (
              <Link to="/history" className="text-[12px] font-medium text-brand-500 hover:underline">
                View all
              </Link>
            ) : null
          }
        >
          {recent.length === 0 ? (
            <p className="muted py-8 text-center text-[13px]">
              Codes you save will appear here for quick reuse.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md"
                    style={{ background: '#fff', border: '1px solid rgb(var(--border))' }}
                  >
                    {e.thumbnail && <img src={e.thumbnail} alt="" className="h-full w-full object-contain p-0.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{e.title}</p>
                    <p className="muted truncate font-mono text-[11px]">{e.data}</p>
                  </div>
                  <Link
                    to={e.kind === 'qr' ? '/qr' : '/barcode'}
                    state={{ options: e.options }}
                    className="btn-subtle shrink-0 px-2 py-1 text-[12px]"
                  >
                    Reuse
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---- Trust notes ---- */}
        <div className="space-y-3">
          <InfoCard
            icon={<ShieldCheck className="h-[18px] w-[18px]" />}
            title="Your data stays here"
            body="Every code is generated in your browser. Payloads, spreadsheets and logos are never sent to a server."
          />
          <InfoCard
            icon={<WifiOff className="h-[18px] w-[18px]" />}
            title="Works offline"
            body="Once loaded, the whole studio keeps working without a network connection."
          />
          <InfoCard
            icon={<ScanLine className="h-[18px] w-[18px]" />}
            title="Verify before you print"
            body={
              <>
                Use the{' '}
                <Link to="/scan" className="text-brand-500 hover:underline">
                  Scanner
                </Link>{' '}
                to confirm a code resolves correctly before committing to a production run.
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  return (
    <div className="panel flex gap-3 p-4">
      <span className="muted mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="muted mt-1 text-[12px] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
