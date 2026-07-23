const DB_NAME = "starlitsky-cattery";
const DB_VERSION = 1;
const IMAGE_STORE = "cat-images";

export type CatImageSlot = "cover" | "gallery";

export interface CatImageRecord {
  id: string;
  catId: string;
  slot: CatImageSlot;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
}

function isBrowser() {
  return typeof window !== "undefined";
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
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
        store.createIndex("catId", "catId", { unique: false });
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

export async function saveCatImage(
  catId: string,
  slot: CatImageSlot,
  file: File,
): Promise<CatImageRecord> {
  const record: CatImageRecord = {
    id: `cat-${catId}-image-${createStableId()}`,
    catId,
    slot,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file,
  };
  await runImageTransaction("readwrite", (store) => store.put(record));
  return record;
}

export async function getCatImageBlob(id: string) {
  try {
    const record = await runImageTransaction<CatImageRecord | undefined>("readonly", (store) =>
      store.get(id),
    );
    return record?.blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteCatImageBlob(id: string) {
  try {
    await runImageTransaction("readwrite", (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}

export async function deleteCatImageBlobs(ids: string[]) {
  const results = await Promise.all(ids.map((id) => deleteCatImageBlob(id)));
  return results.every(Boolean);
}

export async function deleteCatImagesForCat(catId: string) {
  try {
    const records = await runImageTransaction<CatImageRecord[]>("readonly", (store) => {
      const index = store.index("catId");
      return index.getAll(catId);
    });
    return deleteCatImageBlobs(records.map((record) => record.id));
  } catch {
    return false;
  }
}

function createStableId() {
  if (isBrowser() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
