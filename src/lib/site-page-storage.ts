import { cloneAboutContent, normalizeAboutContent, type AboutContent } from "./about-content";

const ABOUT_SAVED_KEY = "starlitsky.site-page.about.saved.v1";
const ABOUT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.about.draft-preview.v1";
const ABOUT_SAVED_EVENT = "starlitsky:site-page-about-saved";
const DB_NAME = "starlitsky-site-pages";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

export type SitePageImageRecord = {
  id: string;
  pageId: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readAboutContent(key: string): AboutContent {
  if (!isBrowser()) return cloneAboutContent();

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return cloneAboutContent();
    return normalizeAboutContent(JSON.parse(raw));
  } catch {
    return cloneAboutContent();
  }
}

function writeAboutContent(key: string, content: AboutContent) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(normalizeAboutContent(content)));
  } catch {
    // localStorage can fail in private browsing or quota edge cases; callers fall back to defaults.
  }
}

export function loadSavedAboutContent() {
  return readAboutContent(ABOUT_SAVED_KEY);
}

export function saveAboutContent(content: AboutContent) {
  if (!isBrowser()) return;
  writeAboutContent(ABOUT_SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(ABOUT_SAVED_EVENT));
}

export function loadDraftPreviewAboutContent() {
  return readAboutContent(ABOUT_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewAboutContent(content: AboutContent) {
  writeAboutContent(ABOUT_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedAboutContent(callback: () => void) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === ABOUT_SAVED_KEY) callback();
  };
  const onSaved = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(ABOUT_SAVED_EVENT, onSaved);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ABOUT_SAVED_EVENT, onSaved);
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

export async function saveSitePageImage(pageId: string, file: File): Promise<SitePageImageRecord> {
  const record: SitePageImageRecord = {
    id: `site-page-${pageId}-img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    pageId,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file,
  };
  await runImageTransaction("readwrite", (store) => store.put(record));
  return record;
}

export async function getSitePageImageBlob(id: string) {
  try {
    const record = await runImageTransaction<SitePageImageRecord | undefined>("readonly", (store) =>
      store.get(id),
    );
    return record?.blob ?? null;
  } catch {
    return null;
  }
}
