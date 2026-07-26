const DB_NAME = "starlitsky-cattery";
const DB_VERSION = 2;
const IMAGE_STORE = "cat-images";

export type EntityImageType = "cat" | "litter";
export type EntityImageSlot = "cover" | "gallery";
export type CatImageSlot = EntityImageSlot;

export interface EntityImageRecord {
  id: string;
  entityType: EntityImageType;
  entityId: string;
  entityKey: string;
  slot: EntityImageSlot;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
  catId?: string;
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

    let settled = false;
    let request: IDBOpenDBRequest;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(IMAGE_STORE)
          ? request.transaction?.objectStore(IMAGE_STORE)
          : db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
        if (!store) return;

        if (!store.indexNames.contains("catId")) {
          store.createIndex("catId", "catId", { unique: false });
        }
        if (!store.indexNames.contains("entityKey")) {
          store.createIndex("entityKey", "entityKey", { unique: false });
        }

        if (request.transaction && request.transaction.mode === "versionchange") {
          store.openCursor().onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!cursor) return;
            const value = cursor.value as Partial<EntityImageRecord> & { catId?: string };
            if (!value || typeof value !== "object") {
              cursor.continue();
              return;
            }
            const entityType = value.entityType === "litter" ? "litter" : "cat";
            const entityId =
              typeof value.entityId === "string" && value.entityId
                ? value.entityId
                : typeof value.catId === "string" && value.catId
                  ? value.catId
                  : "";
            if (entityId) {
              cursor.update({
                ...value,
                entityType,
                entityId,
                entityKey: createEntityKey(entityType, entityId),
                catId:
                  entityType === "cat"
                    ? typeof value.catId === "string" && value.catId
                      ? value.catId
                      : entityId
                    : value.catId,
              });
            }
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        resolve(db);
      };
      request.onerror = () => {
        fail(request.error ?? new Error("Failed to open IndexedDB."));
      };
      request.onblocked = () => {
        fail(new Error("IndexedDB open was blocked by another connection."));
      };
    } catch (error) {
      fail(toError(error, "Failed to open IndexedDB."));
    }
  });
}

function runImageTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openImageDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let settled = false;
        let tx: IDBTransaction | undefined;
        let request: IDBRequest<T> | undefined;
        let result: T;

        const finalize = (complete: () => void) => {
          if (settled) return;
          settled = true;
          db.close();
          complete();
        };
        const fail = (fallbackMessage: string, error?: unknown) => {
          finalize(() => {
            reject(toError(error ?? tx?.error ?? request?.error, fallbackMessage));
          });
        };

        try {
          tx = db.transaction(IMAGE_STORE, mode);
          const store = tx.objectStore(IMAGE_STORE);
          request = run(store);
          request.onsuccess = () => {
            result = request?.result as T;
          };
          request.onerror = () => {
            // The transaction error/abort event decides the final Promise state.
          };
          tx.oncomplete = () => {
            finalize(() => resolve(result));
          };
          tx.onerror = () => {
            fail("IndexedDB transaction failed.");
          };
          tx.onabort = () => {
            fail("IndexedDB transaction aborted.");
          };
        } catch (error) {
          fail("IndexedDB transaction setup failed.", error);
        }
      }),
  );
}

function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

export async function saveEntityImage(
  entityType: EntityImageType,
  entityId: string,
  slot: EntityImageSlot,
  file: File,
): Promise<EntityImageRecord> {
  const record: EntityImageRecord = {
    id: `${entityType}-${entityId}-image-${createStableId()}`,
    entityType,
    entityId,
    entityKey: createEntityKey(entityType, entityId),
    slot,
    name: file.name,
    type: file.type,
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file,
    catId: entityType === "cat" ? entityId : undefined,
  };
  await runImageTransaction("readwrite", (store) => store.put(record));
  return record;
}

export async function saveCatImage(catId: string, slot: CatImageSlot, file: File) {
  return saveEntityImage("cat", catId, slot, file);
}

export async function getEntityImageBlob(id: string) {
  try {
    const record = await runImageTransaction<EntityImageRecord | undefined>("readonly", (store) =>
      store.get(id),
    );
    return record?.blob ?? null;
  } catch {
    return null;
  }
}

export async function getCatImageBlob(id: string) {
  return getEntityImageBlob(id);
}

export async function deleteEntityImageBlob(id: string) {
  try {
    await runImageTransaction("readwrite", (store) => store.delete(id));
    return true;
  } catch {
    return false;
  }
}

export async function deleteCatImageBlob(id: string) {
  return deleteEntityImageBlob(id);
}

export async function deleteEntityImageBlobs(ids: string[]) {
  const results = await Promise.all(ids.map((id) => deleteEntityImageBlob(id)));
  return results.every(Boolean);
}

export async function deleteCatImageBlobs(ids: string[]) {
  return deleteEntityImageBlobs(ids);
}

export async function deleteEntityImagesForEntity(entityType: EntityImageType, entityId: string) {
  try {
    const records = await runImageTransaction<EntityImageRecord[]>("readonly", (store) => {
      const index = store.index("entityKey");
      return index.getAll(createEntityKey(entityType, entityId));
    });
    return deleteEntityImageBlobs(records.map((record) => record.id));
  } catch {
    return false;
  }
}

export async function deleteCatImagesForCat(catId: string) {
  return deleteEntityImagesForEntity("cat", catId);
}

function createStableId() {
  if (isBrowser() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createEntityKey(entityType: EntityImageType, entityId: string) {
  return `${entityType}:${entityId}`;
}
