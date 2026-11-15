import type { LocalDraftBackup } from '../types/studio';

const DB_NAME = 'novel-ariel-alie-studio-db';
const DB_VERSION = 1;
const STORE_NAME = 'draft_backups';
const FALLBACK_LS_PREFIX = 'novel-studio-backup:';

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chapterId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function saveFallbackLs(backup: LocalDraftBackup): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        `${FALLBACK_LS_PREFIX}${backup.chapterId}`,
        JSON.stringify(backup),
      );
    }
  } catch {
    // Ignore quota errors
  }
}

function getFallbackLs(chapterId: string): LocalDraftBackup | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${FALLBACK_LS_PREFIX}${chapterId}`);
    return raw ? (JSON.parse(raw) as LocalDraftBackup) : null;
  } catch {
    return null;
  }
}

function deleteFallbackLs(chapterId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${FALLBACK_LS_PREFIX}${chapterId}`);
    }
  } catch {
    // Ignore
  }
}

export async function saveLocalDraftBackup(
  backup: LocalDraftBackup,
): Promise<void> {
  saveFallbackLs(backup);
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(backup);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB write failed'));
      };
    });
  } catch {
    // Fallback to localStorage already persisted above
  }
}

export async function loadLocalDraftBackup(
  chapterId: string,
): Promise<LocalDraftBackup | null> {
  try {
    const db = await openDraftDb();
    const record = await new Promise<LocalDraftBackup | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(chapterId);
      req.onsuccess = () => {
        resolve((req.result as LocalDraftBackup | undefined) ?? null);
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
      tx.oncomplete = () => db.close();
    });
    return record ?? getFallbackLs(chapterId);
  } catch {
    return getFallbackLs(chapterId);
  }
}

export async function clearLocalDraftBackup(chapterId: string): Promise<void> {
  deleteFallbackLs(chapterId);
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(chapterId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB delete failed'));
      };
    });
  } catch {
    // Ignore
  }
}

export async function listDirtyLocalBackups(): Promise<LocalDraftBackup[]> {
  const results: LocalDraftBackup[] = [];
  try {
    const db = await openDraftDb();
    const records = await new Promise<LocalDraftBackup[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as LocalDraftBackup[]) || []);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB list failed'));
      tx.oncomplete = () => db.close();
    });
    return records.filter((r) => r.dirty);
  } catch {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(FALLBACK_LS_PREFIX)) {
          const item = getFallbackLs(key.slice(FALLBACK_LS_PREFIX.length));
          if (item && item.dirty) results.push(item);
        }
      }
    }
    return results;
  }
}
