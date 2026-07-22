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
import {
  cloneAftercareContent,
  normalizeAftercareContent,
  type AftercareContent,
} from "./aftercare-content";
import {
  cloneProcessContent,
  normalizeProcessContent,
  type ProcessContent,
} from "./process-content";
import {
  cloneContactContent,
  normalizeContactContent,
  type ContactContent,
} from "./contact-content";

const ABOUT_SAVED_KEY = "starlitsky.site-page.about.saved.v1";
const ABOUT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.about.draft-preview.v1";
const ABOUT_SAVED_EVENT = "starlitsky:site-page-about-saved";
const ENVIRONMENT_SAVED_KEY = "starlitsky.site-page.environment.saved.v1";
const ENVIRONMENT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.environment.draft-preview.v1";
const ENVIRONMENT_SAVED_EVENT = "starlitsky:site-page-environment-saved";
const FEEDING_SAVED_KEY = "starlitsky.site-page.feeding.saved.v1";
const FEEDING_DRAFT_PREVIEW_KEY = "starlitsky.site-page.feeding.draft-preview.v1";
const FEEDING_SAVED_EVENT = "starlitsky:site-page-feeding-saved";
const AFTERCARE_SAVED_KEY = "starlitsky.site-page.aftercare.saved.v1";
const AFTERCARE_DRAFT_PREVIEW_KEY = "starlitsky.site-page.aftercare.draft-preview.v1";
const AFTERCARE_SAVED_EVENT = "starlitsky:site-page-aftercare-saved";
const PROCESS_SAVED_KEY = "starlitsky.site-page.process.saved.v1";
const PROCESS_DRAFT_PREVIEW_KEY = "starlitsky.site-page.process.draft-preview.v1";
const PROCESS_SAVED_EVENT = "starlitsky:site-page-process-saved";
const CONTACT_SAVED_KEY = "starlitsky.site-page.contact.saved.v1";
const CONTACT_DRAFT_PREVIEW_KEY = "starlitsky.site-page.contact.draft-preview.v1";
const CONTACT_SAVED_EVENT = "starlitsky:site-page-contact-saved";
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

function readAftercareContent(key: string): AftercareContent {
  return readContent(key, cloneAftercareContent, normalizeAftercareContent);
}

function writeAftercareContent(key: string, content: AftercareContent) {
  writeContent(key, content, normalizeAftercareContent);
}

function readProcessContent(key: string): ProcessContent {
  return readContent(key, cloneProcessContent, normalizeProcessContent);
}

function writeProcessContent(key: string, content: ProcessContent) {
  writeContent(key, content, normalizeProcessContent);
}

function readContactContent(key: string): ContactContent {
  return readContent(key, cloneContactContent, normalizeContactContent);
}

function writeContactContent(key: string, content: ContactContent) {
  writeContent(key, content, normalizeContactContent);
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

export function loadSavedAftercareContent() {
  return readAftercareContent(AFTERCARE_SAVED_KEY);
}

export function saveAftercareContent(content: AftercareContent) {
  if (!isBrowser()) return;
  writeAftercareContent(AFTERCARE_SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(AFTERCARE_SAVED_EVENT));
}

export function loadDraftPreviewAftercareContent() {
  return readAftercareContent(AFTERCARE_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewAftercareContent(content: AftercareContent) {
  writeAftercareContent(AFTERCARE_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedAftercareContent(callback: () => void) {
  return subscribeToSavedContent(AFTERCARE_SAVED_KEY, AFTERCARE_SAVED_EVENT, callback);
}

export function loadSavedProcessContent() {
  return readProcessContent(PROCESS_SAVED_KEY);
}

export function saveProcessContent(content: ProcessContent) {
  if (!isBrowser()) return;
  writeProcessContent(PROCESS_SAVED_KEY, content);
  window.dispatchEvent(new CustomEvent(PROCESS_SAVED_EVENT));
}

export function loadDraftPreviewProcessContent() {
  return readProcessContent(PROCESS_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewProcessContent(content: ProcessContent) {
  writeProcessContent(PROCESS_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedProcessContent(callback: () => void) {
  return subscribeToSavedContent(PROCESS_SAVED_KEY, PROCESS_SAVED_EVENT, callback);
}

export function loadSavedContactContent() {
  return readContactContent(CONTACT_SAVED_KEY);
}

export function saveContactContent(content: ContactContent) {
  if (!isBrowser()) return;
  writeContactContent(CONTACT_SAVED_KEY, content);
  dispatchContactSavedContentEvent();
}

export function loadDraftPreviewContactContent() {
  return readContactContent(CONTACT_DRAFT_PREVIEW_KEY);
}

export function saveDraftPreviewContactContent(content: ContactContent) {
  writeContactContent(CONTACT_DRAFT_PREVIEW_KEY, content);
}

export function subscribeToSavedContactContent(callback: () => void) {
  return subscribeToSavedContactContentWithBroadcast(callback);
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

function subscribeToSavedContactContentWithBroadcast(callback: () => void) {
  if (!isBrowser()) return () => {};

  const channel = createContactSavedChannel();
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONTACT_SAVED_KEY) callback();
  };
  const onSaved = () => callback();

  if (channel) {
    channel.onmessage = onSaved;
  } else {
    window.addEventListener("storage", onStorage);
  }
  window.addEventListener(CONTACT_SAVED_EVENT, onSaved);

  return () => {
    if (!channel) window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONTACT_SAVED_EVENT, onSaved);
    channel?.close();
  };
}

function dispatchContactSavedContentEvent() {
  window.dispatchEvent(new CustomEvent(CONTACT_SAVED_EVENT));
  const channel = createContactSavedChannel();
  if (!channel) return;
  channel.postMessage({ type: "saved" });
  window.setTimeout(() => channel.close(), 250);
}

function createContactSavedChannel() {
  try {
    if (typeof BroadcastChannel === "undefined") return null;
    return new BroadcastChannel(CONTACT_SAVED_EVENT);
  } catch {
    return null;
  }
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
