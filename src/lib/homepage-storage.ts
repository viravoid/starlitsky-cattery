import {
  cloneHomepageContent,
  normalizeHomepageContent,
  type HomepageContent,
} from "./homepage-content";

const SAVED_KEY = "starlitsky.homepage.saved.v1";
const DRAFT_PREVIEW_KEY = "starlitsky.homepage.draft-preview.v1";
const SAVED_EVENT = "starlitsky:homepage-saved";
const DB_NAME = "starlitsky-homepage";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

export type HomepageImageRecord = {
  id: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readContent(key: string): HomepageContent {
  if (!isBrowser()) return cloneHomepageContent();
  const raw = window.localStorage.getItem(key);
  if (!raw) return cloneHomepageContent();
  try {
    return normalizeHomepageContent(JSON.parse(raw));
  } catch {
    return cloneHomepageContent();
  }
}

function writeContent(key: string, content: HomepageContent) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(normalizeHomepageContent(content)));
}

export function loadSavedHomepageContent() {
  return readContent(SAVED_KEY);
}

export function saveHomepageContent(content: HomepageContent) {
  if (!isBrowser()) return;
  writeContent(SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(SAVED_EVENT));
}

export function loadDraftPreviewHomepageContent() {
  return readContent(DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewHomepageContent(content: HomepageContent) {
  writeContent(DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedHomepageContent(callback: () => void) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_KEY) callback();
  };
  const onSaved = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(SAVED_EVENT, onSaved);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAVED_EVENT, onSaved);
  };
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser() || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function runImageTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openImageDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE, mode);
        const store = tx.objectStore(IMAGE_STORE);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      }),
  );
}

export async function saveHomepageImage(file: File): Promise<HomepageImageRecord> {
  const record: HomepageImageRecord = {
    id: `home-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file,
  };
  await runImageTransaction("readwrite", (store) => store.put(record));
  return record;
}

export async function getHomepageImageBlob(id: string) {
  const record = await runImageTransaction<HomepageImageRecord | undefined>("readonly", (store) =>
    store.get(id),
  );
  return record?.blob ?? null;
}
