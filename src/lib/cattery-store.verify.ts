import {
  CATTERY_STORAGE_KEY,
  catteryActions,
  cloneDefaultCatteryData,
  getCatteryDataSnapshot,
  hydrateCatteryDataFromStorage,
  loadSavedCatteryData,
  normalizeCatteryData,
  resetCatteryDataForTests,
  resolveCatId,
  resolveLitterId,
  saveCatteryData,
  selectKittenRecords,
  selectLitterRecords,
  selectPosts,
  subscribeToCatteryData,
  type CatteryData,
} from "./cattery-store";
import {
  deleteEntityImageBlob,
  deleteEntityImageBlobs,
  deleteEntityImagesForEntity,
  deleteCatImageBlob,
  deleteCatImageBlobs,
  deleteCatImagesForCat,
  getEntityImageBlob,
  getCatImageBlob,
  saveEntityImage,
  saveCatImage,
} from "./cattery-images";
import { actions as communityActions } from "./community-store";

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
    name: "hydrate helper loads saved cattery snapshot",
    run() {
      resetCatteryDataForTests();
      const saved = cloneDefaultCatteryData();
      saved.cats.push({
        id: "kitten-hydrated",
        kind: "kitten",
        name: "Hydrated Kitten",
        gender: "妹妹",
        color: "银虎斑白",
        birthday: "2026-07-26",
        personality: "hydrated",
        galleryImageIds: [],
        visibility: "visible",
        kitten: {
          status: "待找家",
          price: "16666",
          litterId: "litter-a",
        },
      });

      withWindowObject(
        {
          localStorage: createStorage(JSON.stringify(saved)),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          assert(!getCatteryDataSnapshot().cats.some((cat) => cat.id === "kitten-hydrated"));
          hydrateCatteryDataFromStorage();
          assert(getCatteryDataSnapshot().cats.some((cat) => cat.id === "kitten-hydrated"));
        },
      );
    },
  },
  {
    name: "storage event refreshes snapshot once without persisting",
    run() {
      resetCatteryDataForTests();
      const next = cloneDefaultCatteryData();
      next.posts = [
        {
          ...next.posts[0]!,
          id: "p-storage",
          content: "storage event content",
        },
      ];
      let storageListener: ((event: StorageEvent) => void) | null = null;
      let subscriberCalls = 0;
      let setItemCalls = 0;

      withWindowObject(
        {
          localStorage: {
            getItem() {
              return null;
            },
            setItem() {
              setItemCalls += 1;
            },
          },
          dispatchEvent() {},
          addEventListener(type: string, listener: (event: StorageEvent) => void) {
            if (type === "storage") storageListener = listener;
          },
          removeEventListener(type: string, listener: (event: StorageEvent) => void) {
            if (type === "storage" && storageListener === listener) storageListener = null;
          },
        },
        () => {
          const unsubscribe = subscribeToCatteryData(() => {
            subscriberCalls += 1;
          });
          assert(storageListener);
          storageListener({
            key: CATTERY_STORAGE_KEY,
            newValue: JSON.stringify(next),
          } as StorageEvent);

          assert(getCatteryDataSnapshot().posts[0]?.id === "p-storage");
          assert(getCatteryDataSnapshot().posts[0]?.content === "storage event content");
          assert(subscriberCalls === 1);
          assert(setItemCalls === 0);
          unsubscribe();
          assert(storageListener === null);
        },
      );
    },
  },
  {
    name: "storage event uses hydrate normalization fallbacks",
    run() {
      resetCatteryDataForTests();
      let storageListener: ((event: StorageEvent) => void) | null = null;

      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener(type: string, listener: (event: StorageEvent) => void) {
            if (type === "storage") storageListener = listener;
          },
          removeEventListener(type: string, listener: (event: StorageEvent) => void) {
            if (type === "storage" && storageListener === listener) storageListener = null;
          },
        },
        () => {
          const unsubscribe = subscribeToCatteryData(() => {});
          assert(storageListener);

          storageListener({
            key: CATTERY_STORAGE_KEY,
            newValue: "{bad json",
          } as StorageEvent);
          assert(getCatteryDataSnapshot().version === 1);
          assert(getCatteryDataSnapshot().cats.length === cloneDefaultCatteryData().cats.length);

          storageListener({
            key: CATTERY_STORAGE_KEY,
            newValue: JSON.stringify({
              users: [{ id: "parent-storage", name: "Storage 家长", role: "parent" }],
              cats: [
                {
                  id: "cat-chonglou",
                  ownerId: "parent-storage",
                  name: "Legacy Alias",
                },
              ],
              posts: [
                {
                  id: "p-storage-legacy",
                  authorId: "parent-storage",
                  authorName: "Storage 家长",
                  authorRole: "星月家长",
                  category: "家长分享",
                  content: "legacy alias",
                  imageCount: 0,
                  catIds: ["cat-chonglou"],
                  litterIds: ["A窝"],
                  createdAt: "2026-01-01T00:00:00",
                  likes: 0,
                  likedByMe: false,
                  comments: [],
                },
              ],
            }),
          } as StorageEvent);
          assert(getCatteryDataSnapshot().cats.some((cat) => cat.id === "chonglou"));
          assert(getCatteryDataSnapshot().posts[0]?.catIds[0] === "chonglou");
          assert(getCatteryDataSnapshot().posts[0]?.litterIds?.[0] === "litter-a");

          storageListener({
            key: CATTERY_STORAGE_KEY,
            newValue: null,
          } as StorageEvent);
          assert(getCatteryDataSnapshot().posts.some((post) => post.id === "p-1"));
          unsubscribe();
        },
      );
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
    name: "parent post create and update strip litter input but keep legal cat links",
    run() {
      resetCatteryDataForTests();
      const createdId = catteryActions.createPost(
        {
          category: "家长分享",
          content: "parent mixed input",
          imageCount: 1,
          catIds: ["cat-huhu", "cat-toast"],
          litterIds: ["A窝", "litter-b"],
        },
        { role: "parent", currentUserId: "parent-huhu" },
      );
      assert(createdId);
      const created = getCatteryDataSnapshot().posts.find((post) => post.id === createdId);
      assert(created?.catIds.length === 1);
      assert(created.catIds[0] === "cat-huhu");
      assert((created.litterIds ?? []).length === 0);

      const beforeLitterIds = [
        ...(getCatteryDataSnapshot().posts.find((post) => post.id === "p-3")?.litterIds ?? []),
      ];
      const updated = catteryActions.updatePost(
        "p-3",
        {
          content: "parent update keeps cat",
          catIds: ["cat-huhu", "cat-toast"],
          litterIds: ["C窝"],
        },
        { role: "parent", currentUserId: "parent-huhu" },
      );
      const post = getCatteryDataSnapshot().posts.find((item) => item.id === "p-3");
      assert(updated);
      assert(post?.content === "parent update keeps cat");
      assert(post?.catIds.length === 1);
      assert(post?.catIds[0] === "cat-huhu");
      assert(JSON.stringify(post?.litterIds ?? []) === JSON.stringify(beforeLitterIds));
    },
  },
  {
    name: "keeper post create and update keep litter associations",
    run() {
      resetCatteryDataForTests();
      const createdId = catteryActions.createPost(
        {
          category: "猫舍日常",
          content: "keeper litter input",
          imageCount: 0,
          catIds: ["cat-huhu"],
          litterIds: ["A窝"],
        },
        { role: "keeper", currentUserId: "keeper-yueqi" },
      );
      assert(createdId);
      assert(
        getCatteryDataSnapshot().posts.find((post) => post.id === createdId)?.litterIds?.[0] ===
          "litter-a",
      );

      const updated = catteryActions.updatePost(
        createdId,
        { litterIds: ["B窝"], content: "keeper litter update" },
        { role: "keeper", currentUserId: "keeper-xingxia" },
      );
      const post = getCatteryDataSnapshot().posts.find((item) => item.id === createdId);
      assert(updated);
      assert(post?.content === "keeper litter update");
      assert(post?.litterIds?.[0] === "litter-b");
    },
  },
  {
    name: "forged and invalid actors cannot update posts or notify",
    run() {
      resetCatteryDataForTests();
      const before = snapshotJson();
      let subscriberCalls = 0;
      let setItemCalls = 0;

      withWindowObject(
        {
          localStorage: {
            getItem() {
              return null;
            },
            setItem() {
              setItemCalls += 1;
            },
          },
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          const unsubscribe = subscribeToCatteryData(() => {
            subscriberCalls += 1;
          });
          assert(
            !catteryActions.updatePost(
              "p-3",
              { content: "guest forged" },
              { role: "guest", currentUserId: "parent-huhu" },
            ),
          );
          assert(
            !catteryActions.updatePost(
              "p-3",
              { content: "user forged" },
              { role: "user", currentUserId: "parent-huhu" },
            ),
          );
          assert(
            !catteryActions.updatePost(
              "p-3",
              { content: "missing user" },
              { role: "parent", currentUserId: "parent-missing" },
            ),
          );
          unsubscribe();
        },
      );

      assert(snapshotJson() === before);
      assert(subscriberCalls === 0);
      assert(setItemCalls === 0);
    },
  },
  {
    name: "id kind and createdAt cat patch fields are ignored",
    run() {
      resetCatteryDataForTests();
      catteryActions.updateCat(
        "cat-huhu",
        {
          id: "changed",
          kind: "stud",
          createdAt: "changed",
          name: "呼呼更新",
        },
        { role: "parent", currentUserId: "parent-huhu" },
      );
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
    name: "post edit permission matrix is enforced",
    run() {
      resetCatteryDataForTests();
      assert(
        !catteryActions.updatePost(
          "p-2",
          { content: "other parent" },
          { role: "parent", currentUserId: "parent-huhu" },
        ),
      );
      assert(
        catteryActions.updatePost(
          "p-3",
          { content: "own parent", category: "猫舍日常", pinned: true, hidden: true },
          { role: "parent", currentUserId: "parent-huhu" },
        ),
      );
      const parentPost = selectPosts().find((item) => item.id === "p-3");
      assert(parentPost?.category === "家长分享");
      assert(parentPost?.pinned !== true);
      assert(parentPost?.hidden !== true);
      assert(
        catteryActions.updatePost(
          "p-4",
          { content: "keeper peer" },
          { role: "keeper", currentUserId: "keeper-yueqi" },
        ),
      );
      assert(
        !catteryActions.updatePost(
          "p-2",
          { content: "keeper cannot rewrite parent" },
          { role: "keeper", currentUserId: "keeper-yueqi" },
        ),
      );
      assert(
        selectPosts().find((item) => item.id === "p-2")?.content !== "keeper cannot rewrite parent",
      );
    },
  },
  {
    name: "facade destructive actions require the current actor",
    run() {
      resetCatteryDataForTests();
      communityActions.logout();
      const before = snapshotJson();
      assert(communityActions.updateCat("cat-huhu", { name: "guest rename" }) === false);
      assert(communityActions.deleteCat("cat-huhu") === false);
      assert(communityActions.deletePost("p-3") === false);
      assert(communityActions.addParent("Blocked Parent", "BLOCKED") === null);
      assert(communityActions.toggleParentActive("parent-toast") === false);
      assert(snapshotJson() === before);

      communityActions.activateParent("DEMO");
      assert(communityActions.updateCat("cat-huhu", { name: "parent own cat" }) === true);
      assert(
        getCatteryDataSnapshot().cats.find((cat) => cat.id === "cat-huhu")?.name ===
          "parent own cat",
      );
      assert(
        communityActions.updateCat("cat-toast", { name: "blocked other parent cat" }) === false,
      );
      assert(communityActions.updateCat("chonglou", { name: "blocked cattery cat" }) === false);
      assert(communityActions.deletePost("p-2") === false);
      assert(communityActions.deletePost("p-3") === true);

      resetCatteryDataForTests();
      communityActions.becomeKeeper();
      assert(communityActions.updateCat("cat-huhu", { name: "keeper cat edit" }) === true);
      assert(communityActions.togglePin("p-2") === true);
      assert(getCatteryDataSnapshot().posts.find((post) => post.id === "p-2")?.pinned === true);
      assert(communityActions.toggleHidePost("p-2") === true);
      assert(getCatteryDataSnapshot().posts.find((post) => post.id === "p-2")?.hidden === true);
      assert(communityActions.deletePost("p-2") === true);
      assert(!getCatteryDataSnapshot().posts.some((post) => post.id === "p-2"));
      const parentId = communityActions.addParent("Keeper Added", "KEEPER-ADDED");
      assert(typeof parentId === "string");
      assert(communityActions.toggleParentActive(parentId) === true);
      communityActions.logout();
    },
  },
  {
    name: "subscriber failures are isolated",
    run() {
      resetCatteryDataForTests();
      const previousConsoleError = console.error;
      let secondCalls = 0;
      let errors = 0;
      console.error = () => {
        errors += 1;
      };

      try {
        withWindowObject(
          {
            localStorage: createStorage(null),
            dispatchEvent() {},
            addEventListener() {},
            removeEventListener() {},
          },
          () => {
            const first = subscribeToCatteryData(() => {
              throw new Error("subscriber failed");
            });
            const second = subscribeToCatteryData(() => {
              secondCalls += 1;
            });
            const ok = catteryActions.updatePost(
              "p-3",
              { content: "still succeeds" },
              { role: "parent", currentUserId: "parent-huhu" },
            );
            first();
            second();
            assert(ok);
          },
        );
      } finally {
        console.error = previousConsoleError;
      }

      assert(secondCalls === 1);
      assert(errors === 1);
      assert(selectPosts().find((post) => post.id === "p-3")?.content === "still succeeds");
    },
  },
  {
    name: "duplicate post ids normalize deterministically",
    run() {
      const base = cloneDefaultCatteryData();
      const duplicated = {
        ...base,
        posts: [
          {
            ...base.posts[0]!,
            id: "p-duplicate",
            authorId: "keeper-yueqi",
            authorRole: "猫舍主理人",
            content: "first duplicate",
          },
          {
            ...base.posts[1]!,
            id: "p-duplicate",
            authorId: "keeper-yueqi",
            authorRole: "猫舍主理人",
            content: "second duplicate",
          },
        ],
      };
      const first = normalizeCatteryData(duplicated);
      const second = normalizeCatteryData(first);
      assert(first.posts.length === 1);
      assert(first.posts[0]?.content === "first duplicate");
      assert(JSON.stringify(first) === JSON.stringify(second));

      resetCatteryDataForTests(first);
      assert(
        catteryActions.updatePost(
          "p-duplicate",
          { content: "updated duplicate" },
          { role: "keeper", currentUserId: "keeper-yueqi" },
        ),
      );
      assert(
        getCatteryDataSnapshot().posts.filter((post) => post.id === "p-duplicate").length === 1,
      );
      assert(getCatteryDataSnapshot().posts[0]?.content === "updated duplicate");
      assert(
        catteryActions.deletePost("p-duplicate", { role: "keeper", currentUserId: "keeper-yueqi" }),
      );
      assert(!getCatteryDataSnapshot().posts.some((post) => post.id === "p-duplicate"));
    },
  },
  {
    name: "stud has no hard delete action",
    run() {
      assert(!("deleteStud" in catteryActions));
    },
  },
  {
    name: "keeper kitten and litter actions update persisted records and public selectors",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };
      const litterId = catteryActions.addLitter(
        {
          name: "D窝",
          birthDate: "2026-07-20",
          status: "待开放",
          note: "new litter",
        },
        keeper,
      );
      assert(typeof litterId === "string");

      const kittenId = catteryActions.addKitten(
        {
          name: "星点",
          gender: "弟弟",
          color: "黑银虎斑",
          birthday: "2026-07-21",
          ownerId: "parent-toast",
          personality: "好奇",
          story: ["初次建档"],
          kitten: {
            status: "待找家",
            price: "22000",
            litterId,
            fatherId: "jasper",
            motherId: "aurora",
          },
        },
        keeper,
      );
      assert(typeof kittenId === "string");
      assert(
        catteryActions.updateKitten(
          kittenId,
          {
            visibility: "hidden",
            kitten: {
              status: "找家中",
              price: "24000",
              litterId,
              fatherId: "jasper",
              motherId: "aurora",
            },
          },
          keeper,
        ) === true,
      );
      assert(
        catteryActions.updateLitter(
          litterId,
          { status: "成长记录中", note: "updated note", visibility: "hidden" },
          keeper,
        ) === true,
      );
      assert(catteryActions.setCatVisibility(kittenId, "archived", keeper) === true);
      assert(catteryActions.setLitterVisibility(litterId, "hidden", keeper) === true);

      const snapshot = getCatteryDataSnapshot();
      const kitten = snapshot.cats.find((cat) => cat.id === kittenId);
      const litter = snapshot.litters.find((item) => item.id === litterId);
      assert(kitten?.kind === "kitten");
      assert(kitten?.visibility === "archived");
      assert(kitten?.kitten?.status === "找家中");
      assert(kitten?.kitten?.price === "24000");
      assert(kitten?.kitten?.litterId === litterId);
      assert(litter?.status === "成长记录中");
      assert(litter?.visibility === "hidden");
      assert(!selectKittenRecords(snapshot).some((item) => item.id === kittenId));
      assert(!selectLitterRecords(snapshot).some((item) => item.id === litterId));
      assert(selectKittenRecords(snapshot, "all").some((item) => item.id === kittenId));
      assert(selectLitterRecords(snapshot, "all").some((item) => item.id === litterId));
    },
  },
  {
    name: "IndexedDB open blocked rejects",
    async run() {
      await withWindowObject(
        {
          indexedDB: createFakeIndexedDb("complete", "blocked"),
          crypto: { randomUUID: () => "blocked" },
        },
        async () => {
          const result = await Promise.race([
            saveCatImage("cat-huhu", "cover", new File(["x"], "x.png", { type: "image/png" })).then(
              () => "resolved",
              (error) =>
                error instanceof Error && error.message.includes("blocked")
                  ? "blocked"
                  : "rejected",
            ),
            waitForMicrotasks(5).then(() => "timeout"),
          ]);
          assert(result === "blocked");
        },
      );
    },
  },
  {
    name: "IndexedDB open blocked then success still rejects once and closes db",
    async run() {
      const indexedDB = createFakeIndexedDb("complete", "blocked-then-success");
      await withWindowObject(
        {
          indexedDB,
          crypto: { randomUUID: () => "blocked-success" },
        },
        async () => {
          let outcomes = 0;
          const result = await saveCatImage(
            "cat-huhu",
            "cover",
            new File(["x"], "x.png", { type: "image/png" }),
          ).then(
            () => {
              outcomes += 1;
              return "resolved";
            },
            () => {
              outcomes += 1;
              return "rejected";
            },
          );
          await waitForMicrotasks(3);
          assert(result === "rejected");
          assert(outcomes === 1);
          assert(indexedDB.closeCount === 1);
        },
      );
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
    name: "IndexedDB rejects when transaction aborts after request success",
    async run() {
      await withWindowObject(
        {
          indexedDB: createFakeIndexedDb("abort-after-request"),
          crypto: { randomUUID: () => "abort-after" },
        },
        async () => {
          let rejected = false;
          try {
            await saveCatImage(
              "cat-huhu",
              "cover",
              new File(["x"], "x.png", { type: "image/png" }),
            );
          } catch (error) {
            rejected = error instanceof Error && error.message.includes("aborted");
          }
          assert(rejected);
          await waitForMicrotasks();
        },
      );
    },
  },
  {
    name: "IndexedDB rejects when transaction aborts before request success",
    async run() {
      await withWindowObject(
        {
          indexedDB: createFakeIndexedDb("abort-before-request"),
          crypto: { randomUUID: () => "abort-before" },
        },
        async () => {
          const result = await Promise.race([
            saveCatImage("cat-huhu", "cover", new File(["x"], "x.png", { type: "image/png" })).then(
              () => "resolved",
              () => "rejected",
            ),
            waitForMicrotasks(5).then(() => "timeout"),
          ]);
          assert(result === "rejected");
          await waitForMicrotasks();
        },
      );
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

function snapshotJson() {
  return JSON.stringify(getCatteryDataSnapshot());
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

type FakeTransactionOutcome = "complete" | "abort-after-request" | "abort-before-request";
type FakeOpenOutcome = "success" | "blocked" | "blocked-then-success";

function createFakeIndexedDb(
  outcome: FakeTransactionOutcome = "complete",
  openOutcome: FakeOpenOutcome = "success",
) {
  const records = new Map<string, unknown>();
  let initialized = false;

  const fake = {
    closeCount: 0,
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
            indexNames: {
              contains() {
                return false;
              },
            },
            createIndex() {},
            openCursor() {
              return successRequest(null, () => {});
            },
          };
        },
        transaction() {
          let finished = false;
          const tx = {
            error: null as Error | null,
            objectStore() {
              const finishTransaction = () => {
                if (finished) return;
                finished = true;
                if (outcome === "complete") {
                  tx.oncomplete?.();
                  return;
                }
                tx.error = new Error("Fake IndexedDB transaction aborted.");
                tx.onabort?.();
              };
              const requestSuccess = <T>(result: T) =>
                successRequest(result, () => {
                  if (outcome !== "abort-before-request") queueMicrotask(finishTransaction);
                });

              return {
                indexNames: {
                  contains(name: string) {
                    return name === "catId" || name === "entityKey";
                  },
                },
                put(record: { id: string }) {
                  records.set(record.id, record);
                  return requestSuccess(record);
                },
                get(id: string) {
                  return requestSuccess(records.get(id));
                },
                delete(id: string) {
                  records.delete(id);
                  return requestSuccess(undefined);
                },
                index(indexName: string) {
                  return {
                    getAll(value: string) {
                      return requestSuccess(
                        [...records.values()].filter(
                          (record) =>
                            typeof record === "object" &&
                            record !== null &&
                            ((indexName === "entityKey" &&
                              "entityKey" in record &&
                              record.entityKey === value) ||
                              (indexName === "catId" &&
                                "catId" in record &&
                                record.catId === value)),
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
          if (outcome === "abort-before-request") {
            queueMicrotask(() => {
              if (finished) return;
              finished = true;
              tx.error = new Error("Fake IndexedDB transaction aborted.");
              tx.onabort?.();
            });
          }
          return tx;
        },
        close() {
          fake.closeCount += 1;
        },
      };
      const request = {
        result: db,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
      };
      queueMicrotask(() => {
        if (openOutcome === "blocked") {
          request.onblocked?.();
          return;
        }
        if (openOutcome === "blocked-then-success") {
          request.onblocked?.();
          queueMicrotask(() => {
            request.onupgradeneeded?.();
            request.onsuccess?.();
          });
          return;
        }
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return fake;
}

function successRequest<T>(result: T, afterSuccess: () => void) {
  const request = {
    result,
    error: null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  queueMicrotask(() => {
    request.onsuccess?.();
    afterSuccess();
  });
  return request;
}

function waitForMicrotasks(count = 1): Promise<void> {
  if (count <= 0) return Promise.resolve();
  return Promise.resolve().then(() => waitForMicrotasks(count - 1));
}
