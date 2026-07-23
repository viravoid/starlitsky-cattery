import {
  catteryActions,
  cloneDefaultCatteryData,
  getCatteryDataSnapshot,
  loadSavedCatteryData,
  normalizeCatteryData,
  resetCatteryDataForTests,
  resolveCatId,
  resolveLitterId,
  saveCatteryData,
  selectPosts,
  type CatteryData,
} from "./cattery-store";
import {
  deleteCatImageBlob,
  deleteCatImageBlobs,
  deleteCatImagesForCat,
  getCatImageBlob,
  saveCatImage,
} from "./cattery-images";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [
  {
    name: "no storage returns default data",
    run() {
      withWindowStorage(null, () => {
        assert(loadSavedCatteryData().version === 1);
      });
    },
  },
  {
    name: "canonical v1 round trip",
    run() {
      const data = cloneDefaultCatteryData();
      const roundTrip = normalizeCatteryData(JSON.parse(JSON.stringify(data)));
      assert(roundTrip.cats.length === data.cats.length);
      assert(roundTrip.posts.find((post) => post.id === "p-5")?.catIds.includes("chonglou"));
    },
  },
  {
    name: "broken JSON falls back without overwriting storage",
    run() {
      const storage = createStorage("{bad json");
      withWindowObject({ localStorage: storage }, () => {
        const data = loadSavedCatteryData();
        assert(data.version === 1);
        assert(storage.value === "{bad json");
      });
    },
  },
  {
    name: "localStorage get and set exceptions are safe",
    run() {
      withWindowObject(
        {
          localStorage: {
            getItem() {
              throw new Error("blocked get");
            },
            setItem() {
              throw new Error("blocked set");
            },
          },
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          assert(loadSavedCatteryData().version === 1);
          saveCatteryData(cloneDefaultCatteryData());
        },
      );
    },
  },
  {
    name: "legacy community shape migrates",
    run() {
      const migrated = normalizeCatteryData({
        users: [{ id: "parent-legacy", name: "Legacy 家长", role: "parent" }],
        cats: [
          {
            id: "cat-legacy",
            ownerId: "parent-legacy",
            name: "Legacy",
            gender: "弟弟",
            birthday: "2026-01-01",
            color: "银虎斑",
            personality: "温柔",
          },
        ],
        posts: [
          {
            id: "p-legacy",
            authorId: "parent-legacy",
            authorName: "Legacy 家长",
            authorRole: "星月家长",
            category: "家长分享",
            content: "legacy",
            imageCount: 0,
            catIds: ["cat-chonglou"],
            litterIds: ["A窝"],
            createdAt: "2026-01-01T00:00:00",
            likes: 0,
            likedByMe: false,
            comments: [],
          },
        ],
      });
      assert(migrated.cats.some((cat) => cat.id === "cat-legacy"));
      assert(migrated.posts[0]?.catIds[0] === "chonglou");
      assert(migrated.posts[0]?.litterIds?.[0] === "litter-a");
    },
  },
  {
    name: "legacy aliases resolve",
    run() {
      assert(resolveCatId("cat-chonglou") === "chonglou");
      assert(resolveLitterId("A窝") === "litter-a");
    },
  },
  {
    name: "id kind and createdAt cat patch fields are ignored",
    run() {
      resetCatteryDataForTests();
      catteryActions.updateCat("cat-huhu", {
        id: "changed",
        kind: "stud",
        createdAt: "changed",
        name: "呼呼更新",
      });
      const cat = getCatteryDataSnapshot().cats.find((item) => item.id === "cat-huhu");
      assert(cat?.id === "cat-huhu");
      assert(cat?.kind === "family");
      assert(cat?.createdAt !== "changed");
      assert(cat?.name === "呼呼更新");
    },
  },
  {
    name: "keeper edits another keeper post and records editor",
    run() {
      resetCatteryDataForTests();
      const ok = catteryActions.updatePost(
        "p-4",
        { content: "主理人协作编辑" },
        { role: "keeper", currentUserId: "keeper-yueqi" },
      );
      const post = selectPosts().find((item) => item.id === "p-4");
      assert(ok);
      assert(post?.authorId === "keeper-xingxia");
      assert(post?.content === "主理人协作编辑");
      assert(post?.lastEditedById === "keeper-yueqi");
      assert(typeof post?.updatedAt === "string");
    },
  },
  {
    name: "keeper cannot rewrite parent post content",
    run() {
      resetCatteryDataForTests();
      const before = selectPosts().find((item) => item.id === "p-2")?.content;
      const ok = catteryActions.updatePost(
        "p-2",
        { content: "不应成功", hidden: true },
        { role: "keeper", currentUserId: "keeper-yueqi" },
      );
      const after = selectPosts().find((item) => item.id === "p-2");
      assert(!ok);
      assert(after?.content === before);
    },
  },
  {
    name: "parent edits only own post",
    run() {
      resetCatteryDataForTests();
      const own = catteryActions.updatePost(
        "p-3",
        { content: "家长自己编辑" },
        { role: "parent", currentUserId: "parent-huhu" },
      );
      const other = catteryActions.updatePost(
        "p-2",
        { content: "不应成功" },
        { role: "parent", currentUserId: "parent-huhu" },
      );
      assert(own);
      assert(!other);
      assert(selectPosts().find((item) => item.id === "p-3")?.content === "家长自己编辑");
    },
  },
  {
    name: "stud has no hard delete action",
    run() {
      assert(!("deleteStud" in catteryActions));
    },
  },
  {
    name: "IndexedDB save get and delete paths work",
    async run() {
      await withWindowObject(
        {
          indexedDB: createFakeIndexedDb(),
          crypto: { randomUUID: () => "image-id" },
        },
        async () => {
          const file = new File(["x"], "x.png", { type: "image/png" });
          const record = await saveCatImage("cat-huhu", "cover", file);
          assert(record.id === "cat-cat-huhu-image-image-id");
          assert((await getCatImageBlob(record.id)) === file);
          assert(await deleteCatImageBlob(record.id));
          assert((await getCatImageBlob(record.id)) === null);

          const first = await saveCatImage("cat-huhu", "gallery", file);
          const second = await saveCatImage("cat-huhu", "gallery", file);
          assert(await deleteCatImageBlobs([first.id, second.id]));

          await saveCatImage("cat-huhu", "gallery", file);
          assert(await deleteCatImagesForCat("cat-huhu"));
        },
      );
    },
  },
  {
    name: "IndexedDB unavailable paths resolve safely",
    async run() {
      await withWindowObject({}, async () => {
        assert((await getCatImageBlob("missing")) === null);
        assert((await deleteCatImageBlob("missing")) === false);
        assert((await deleteCatImageBlobs(["missing"])) === false);
        assert((await deleteCatImagesForCat("cat-huhu")) === false);
        let rejected = false;
        try {
          await saveCatImage("cat-huhu", "cover", new File(["x"], "x.png", { type: "image/png" }));
        } catch {
          rejected = true;
        }
        assert(rejected);
      });
    },
  },
  {
    name: "SSR import path does not require window",
    run() {
      withWindowStorage(undefined, () => {
        assert(normalizeCatteryData(undefined).version === 1);
      });
    },
  },
  {
    name: "clone does not share mutable references",
    run() {
      const first = cloneDefaultCatteryData();
      const second = cloneDefaultCatteryData();
      first.cats[0]?.galleryImageIds.push("mutated");
      assert(!second.cats[0]?.galleryImageIds.includes("mutated"));
    },
  },
];

await run();

async function run() {
  for (const test of tests) {
    await test.run();
  }
  console.log(`cattery-store verification passed (${tests.length} checks)`);
}

function assert(condition: unknown): asserts condition {
  if (!condition) throw new Error("Assertion failed");
}

function createStorage(initial: string | null) {
  return {
    value: initial,
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}

function withWindowStorage(value: string | null | undefined, run: () => void) {
  if (value === undefined) {
    withWindowObject(undefined, run);
    return;
  }
  withWindowObject(
    {
      localStorage: createStorage(value),
      dispatchEvent() {},
      addEventListener() {},
      removeEventListener() {},
    },
    run,
  );
}

function withWindowObject<T>(windowValue: unknown, run: () => T): T {
  const global = globalThis as Record<string, unknown>;
  const hadPrevious = "window" in global;
  const previous = global.window;
  const restore = () => {
    if (hadPrevious) {
      global.window = previous;
    } else {
      Reflect.deleteProperty(global, "window");
    }
  };

  if (windowValue === undefined) {
    Reflect.deleteProperty(global, "window");
  } else {
    global.window = windowValue;
  }

  try {
    const result = run();
    if (isPromiseLike(result)) {
      return result.finally(restore) as T;
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && "finally" in value);
}

function createFakeIndexedDb() {
  const records = new Map<string, unknown>();
  let initialized = false;

  return {
    open() {
      const db = {
        objectStoreNames: {
          contains() {
            return initialized;
          },
        },
        createObjectStore() {
          initialized = true;
          return {
            createIndex() {},
          };
        },
        transaction() {
          const tx = {
            objectStore() {
              return {
                put(record: { id: string }) {
                  records.set(record.id, record);
                  return successRequest(record);
                },
                get(id: string) {
                  return successRequest(records.get(id));
                },
                delete(id: string) {
                  records.delete(id);
                  return successRequest(undefined);
                },
                index() {
                  return {
                    getAll(catId: string) {
                      return successRequest(
                        [...records.values()].filter(
                          (record) =>
                            typeof record === "object" &&
                            record !== null &&
                            "catId" in record &&
                            record.catId === catId,
                        ),
                      );
                    },
                  };
                },
              };
            },
            oncomplete: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onabort: null as (() => void) | null,
          };
          queueMicrotask(() => tx.oncomplete?.());
          return tx;
        },
        close() {},
      };
      const request = {
        result: db,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function successRequest<T>(result: T) {
  const request = {
    result,
    error: null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  queueMicrotask(() => request.onsuccess?.());
  return request;
}
