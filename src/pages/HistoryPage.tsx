import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveAs } from 'file-saver';
import {
  Search,
  Star,
  Trash2,
  Copy,
  Pencil,
  Download,
  History as HistoryIcon,
} from 'lucide-react';
import type { HistoryEntry } from '../lib/types';
import { historyToJson } from '../lib/history';
import { useApp } from '../store';
import { Input, Panel, Segmented, EmptyState } from '../components/ui';

type Filter = 'all' | 'qr' | 'barcode' | 'favorites';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, historyLoaded, loadHistory, removeHistory, toggleFavorite, wipeHistory, notify } =
    useApp();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!historyLoaded) void loadHistory();
  }, [historyLoaded, loadHistory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((e) => {
      if (filter === 'favorites' && !e.favorite) return false;
      if (filter === 'qr' && e.kind !== 'qr') return false;
      if (filter === 'barcode' && e.kind !== 'barcode') return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.data.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [history, query, filter]);

  function reopen(entry: HistoryEntry) {
    navigate(entry.kind === 'qr' ? '/qr' : '/barcode', { state: { options: entry.options } });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">History</h1>
          <p className="muted mt-1 text-[13px]">
            {history.length.toLocaleString()} saved codes, stored locally on this device.
          </p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <button
              className="btn-ghost"
              onClick={() => saveAs(historyToJson(history), 'codeforge-history.json')}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('Delete all saved codes? This cannot be undone.')) {
                  void wipeHistory();
                  notify('History cleared', 'info');
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </button>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            placeholder="Search by name, value or symbology…"
            className="pl-9"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-[320px]">
          <Segmented
            value={filter}
            options={[
              { value: 'all' as Filter, label: 'All' },
              { value: 'qr' as Filter, label: 'QR' },
              { value: 'barcode' as Filter, label: 'Barcode' },
              { value: 'favorites' as Filter, label: '★' },
            ]}
            onChange={setFilter}
          />
        </div>
      </div>

      {!historyLoaded ? (
        <Panel>
          <p className="muted py-10 text-center text-[13px]">Loading…</p>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<HistoryIcon className="h-10 w-10" strokeWidth={1.5} />}
            title={history.length === 0 ? 'Nothing saved yet' : 'No matches'}
            description={
              history.length === 0
                ? 'Generate a code in QR Studio or Barcode Studio and press Save to keep it here for reuse.'
                : 'Try a different search term or filter.'
            }
            action={
              history.length === 0 ? (
                <button className="btn-primary" onClick={() => navigate('/qr')}>
                  Open QR Studio
                </button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <article key={e.id} className="panel flex flex-col overflow-hidden">
              <div className="flex gap-3 p-3">
                <div
                  className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-lg"
                  style={{ background: '#ffffff', border: '1px solid rgb(var(--border))' }}
                >
                  {e.thumbnail ? (
                    <img src={e.thumbnail} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="muted text-[10px]">no preview</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <h3 className="truncate text-[13px] font-semibold" title={e.title}>
                      {e.title}
                    </h3>
                    <button
                      className="shrink-0 p-0.5"
                      aria-label={e.favorite ? 'Remove from favourites' : 'Add to favourites'}
                      onClick={() => void toggleFavorite(e.id)}
                    >
                      <Star
                        className={
                          e.favorite ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'muted h-4 w-4'
                        }
                      />
                    </button>
                  </div>

                  <p className="muted mt-0.5 truncate font-mono text-[11px]" title={e.data}>
                    {e.data}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-brand-600/12 text-brand-500">
                      {e.kind === 'qr' ? 'QR' : 'Barcode'}
                    </span>
                    <span className="muted text-[10.5px]">{timeAgo(e.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto flex border-t">
                <button
                  className="btn-subtle flex-1 rounded-none py-2 text-[12px]"
                  onClick={() => reopen(e)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Reuse
                </button>
                <button
                  className="btn-subtle flex-1 rounded-none border-l py-2 text-[12px]"
                  onClick={() => {
                    void navigator.clipboard.writeText(e.data);
                    notify('Value copied', 'success');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  className="btn-subtle rounded-none border-l px-3 py-2"
                  aria-label="Delete"
                  onClick={() => void removeHistory(e.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
