import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  QrCode,
  Barcode,
  Layers,
  Tags,
  History,
  ScanLine,
  Moon,
  Sun,
  Menu,
  X,
  Code2,
} from 'lucide-react';
import { useApp } from '../store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/qr', label: 'QR Studio', icon: QrCode },
  { to: '/barcode', label: 'Barcode Studio', icon: Barcode },
  { to: '/bulk', label: 'Bulk Generate', icon: Layers },
  { to: '/labels', label: 'Label Designer', icon: Tags },
  { to: '/scan', label: 'Scanner', icon: ScanLine },
  { to: '/history', label: 'History', icon: History },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="CodeForge home">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
        <QrCode className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight tracking-tight">CodeForge</span>
        <span className="muted block text-[10.5px] leading-tight">QR &amp; Barcode Studio</span>
      </span>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition',
              isActive
                ? 'bg-brand-600/12 text-brand-500'
                : 'muted hover:bg-[rgb(var(--border))]/45 hover:text-[rgb(var(--text))]',
            )
          }
        >
          <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Toasts() {
  const { toasts, dismiss } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismiss(t.id)}
          className={clsx(
            'panel pointer-events-auto animate-fade-up cursor-pointer px-4 py-3 text-[13px] shadow-lift',
            t.tone === 'error' && 'border-red-500/40',
            t.tone === 'success' && 'border-accent-500/40',
          )}
        >
          <span
            className={clsx(
              'mr-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full align-middle',
              t.tone === 'error' ? 'bg-red-500' : t.tone === 'success' ? 'bg-accent-500' : 'bg-brand-500',
            )}
          />
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useApp();

  return (
    <div className="flex min-h-full">
      {/* ---- Desktop sidebar ---- */}
      <aside
        className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r p-3 lg:flex"
        style={{ background: 'rgb(var(--surface))' }}
      >
        <div className="px-2 py-2.5">
          <Logo />
        </div>
        <div className="mt-3 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <div className="space-y-2 border-t pt-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="muted flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] transition hover:bg-[rgb(var(--border))]/45"
          >
            <Code2 className="h-4 w-4" strokeWidth={1.9} />
            Source on GitHub
          </a>
          <p className="muted px-3 pb-1 text-[10.5px] leading-relaxed">
            Everything runs in your browser. No data is uploaded.
          </p>
        </div>
      </aside>

      {/* ---- Mobile drawer ---- */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-[260px] animate-fade-up flex-col border-r p-3"
            style={{ background: 'rgb(var(--surface))' }}
          >
            <div className="flex items-center justify-between px-2 py-2.5">
              <Logo />
              <button
                className="btn-subtle p-1.5"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-3 backdrop-blur sm:px-5"
          style={{ background: 'rgb(var(--surface) / 0.85)' }}
        >
          <button
            className="btn-subtle p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="chip mr-1 hidden bg-accent-500/12 text-accent-500 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              Offline-ready
            </span>
            <button
              className="btn-subtle p-2"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </header>

        <main className="flex-1 px-3 py-5 sm:px-5 sm:py-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
