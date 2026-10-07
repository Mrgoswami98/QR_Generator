import type { HistoryEntry } from './types';

/**
 * History storage on IndexedDB.
 *
 * localStorage would be simpler but caps out around 5 MB, and thumbnails fill
 * that in a few dozen entries. IndexedDB stores blobs comfortably and keeps
 * writes off the main thread.
 *
 * Everything stays on the user's device — no payload ever leaves the browser.
 */

const DB_NAME = 'codeforge';
const DB_VERSION = 1;
const STORE = 'history';
const MAX_ENTRIES = 500;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('kind', 'kind');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open local history.'));
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = fn(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('History operation failed.'));
      }),
  );
}

export async function listHistory(): Promise<HistoryEntry[]> {
  try {
    const all = await tx<HistoryEntry[]>('readonly', (s) => s.getAll() as IDBRequest<HistoryEntry[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    // Private browsing or a blocked database should degrade, not crash.
    return [];
  }
}

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(entry));
    await prune();
  } catch {
    /* History is a convenience; never let it break generation. */
  }
}

export async function deleteHistory(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}

/** Trims the oldest non-favourite entries once the cap is exceeded. */
async function prune(): Promise<void> {
  const all = await listHistory();
  if (all.length <= MAX_ENTRIES) return;
  const removable = all.filter((e) => !e.favorite).slice(MAX_ENTRIES);
  await Promise.all(removable.map((e) => deleteHistory(e.id)));
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Exports the whole history as a JSON backup file. */
export function historyToJson(entries: HistoryEntry[]): Blob {
  // Thumbnails are regenerable and dominate the file size, so leave them out.
  const slim = entries.map(({ thumbnail: _thumbnail, ...rest }) => rest);
  return new Blob([JSON.stringify({ version: 1, exportedAt: Date.now(), entries: slim }, null, 2)], {
    type: 'application/json',
  });
}
