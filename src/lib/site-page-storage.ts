import { cloneAboutContent, normalizeAboutContent, type AboutContent } from "./about-content";
import {
  cloneEnvironmentContent,
  normalizeEnvironmentContent,
  type EnvironmentContent,
} from "./environment-content";
import {
  cloneFeedingContent,
  normalizeFeedingContent,
  type FeedingContent,
} from "./feeding-content";

const ABOUT_SAVED_KEY = "starlitsky.site-page.about.saved.v1";
const ABOUT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.about.draft-preview.v1";
const ABOUT_SAVED_EVENT = "starlitsky:site-page-about-saved";
const ENVIRONMENT_SAVED_KEY = "starlitsky.site-page.environment.saved.v1";
const ENVIRONMENT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.environment.draft-preview.v1";
const ENVIRONMENT_SAVED_EVENT = "starlitsky:site-page-environment-saved";
const FEEDING_SAVED_KEY = "starlitsky.site-page.feeding.saved.v1";
const FEEDING_DRAFT_PREVIEW_KEY = "starlitsky.site-page.feeding.draft-preview.v1";
const FEEDING_SAVED_EVENT = "starlitsky:site-page-feeding-saved";
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
  return readContent(key, cloneAboutContent, normalizeAboutContent);
}

function writeAboutContent(key: string, content: AboutContent) {
  writeContent(key, content, normalizeAboutContent);
}

function readEnvironmentContent(key: string): EnvironmentContent {
  return readContent(key, cloneEnvironmentContent, normalizeEnvironmentContent);
}

function writeEnvironmentContent(key: string, content: EnvironmentContent) {
  writeContent(key, content, normalizeEnvironmentContent);
}

function readFeedingContent(key: string): FeedingContent {
  return readContent(key, cloneFeedingContent, normalizeFeedingContent);
}

function writeFeedingContent(key: string, content: FeedingContent) {
  writeContent(key, content, normalizeFeedingContent);
}

function readContent<T>(key: string, cloneDefault: () => T, normalize: (value: unknown) => T): T {
  if (!isBrowser()) return cloneDefault();

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return cloneDefault();
    return normalize(JSON.parse(raw));
  } catch {
    return cloneDefault();
  }
}

function writeContent<T>(key: string, content: T, normalize: (value: unknown) => T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(normalize(content)));
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
  return subscribeToSavedContent(ABOUT_SAVED_KEY, ABOUT_SAVED_EVENT, callback);
}

export function loadSavedEnvironmentContent() {
  return readEnvironmentContent(ENVIRONMENT_SAVED_KEY);
}

export function saveEnvironmentContent(content: EnvironmentContent) {
  if (!isBrowser()) return;
  writeEnvironmentContent(ENVIRONMENT_SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(ENVIRONMENT_SAVED_EVENT));
}

export function loadDraftPreviewEnvironmentContent() {
  return readEnvironmentContent(ENVIRONMENT_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewEnvironmentContent(content: EnvironmentContent) {
  writeEnvironmentContent(ENVIRONMENT_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedEnvironmentContent(callback: () => void) {
  return subscribeToSavedContent(ENVIRONMENT_SAVED_KEY, ENVIRONMENT_SAVED_EVENT, callback);
}

export function loadSavedFeedingContent() {
  return readFeedingContent(FEEDING_SAVED_KEY);
}

export function saveFeedingContent(content: FeedingContent) {
  if (!isBrowser()) return;
  writeFeedingContent(FEEDING_SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(FEEDING_SAVED_EVENT));
}

export function loadDraftPreviewFeedingContent() {
  return readFeedingContent(FEEDING_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewFeedingContent(content: FeedingContent) {
  writeFeedingContent(FEEDING_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedFeedingContent(callback: () => void) {
  return subscribeToSavedContent(FEEDING_SAVED_KEY, FEEDING_SAVED_EVENT, callback);
}

function subscribeToSavedContent(key: string, eventName: string, callback: () => void) {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  const onSaved = () => callback();

  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, onSaved);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, onSaved);
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
    id: `site-page-${pageId}-img-${createStableId()}`,
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

function createStableId() {
  if (isBrowser() && "crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
