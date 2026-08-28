import { cloneAftercareContent } from "./aftercare-content";
import {
  getResolvedCatCoverPresentation,
  getResolvedDetailCarouselPresentation,
} from "./cat-image-presentation";
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
  selectQuestionnaireSubmissions,
  selectStudRecords,
  subscribeToCatteryData,
  type CatteryData,
} from "./cattery-store";
import { cloneQuestionnaireContent } from "./questionnaire-content";
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
import { cloneEnvironmentContent, normalizeEnvironmentContent } from "./environment-content";
import { cloneFeedingContent, normalizeFeedingContent } from "./feeding-content";
import {
  deleteSitePageAssetBlob,
  getSitePageAssetBlob,
  loadDraftPreviewFeedingContent,
  loadSavedAftercareContent,
  loadSavedFeedingContent,
  loadDraftPreviewEnvironmentContent,
  loadSavedEnvironmentContent,
  saveAftercareContent,
  saveDraftPreviewFeedingContent,
  saveDraftPreviewEnvironmentContent,
  saveEnvironmentContent,
  saveFeedingContent,
  saveSitePageAsset,
  subscribeToSavedAftercareContent,
} from "./site-page-storage";

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
    name: "environment content keeps multi-room image order and cover after browser-local save and load",
    run() {
      withCustomEvent(() =>
        withWindowObject(createEventWindow({ localStorage: createStorage(null) }), () => {
          const content = cloneEnvironmentContent();
          content.sections = [
            {
              id: "environment-section-a",
              title: "环境 A",
              summary: "总览摘要",
              meta: "2 个房间",
              coverImageId: "image-b",
              rooms: [
                {
                  id: "room-a1",
                  title: "房间一",
                  description: "第一间",
                  images: [
                    { id: "room-a1-image-1", imageId: "image-a", focalPoint: { x: 18, y: 24 } },
                    { id: "room-a1-image-2", imageId: "image-b", focalPoint: { x: 76, y: 62 } },
                  ],
                },
                {
                  id: "room-a2",
                  title: "房间二",
                  description: "第二间",
                  images: [
                    { id: "room-a2-image-1", imageId: "image-c", focalPoint: { x: 40, y: 55 } },
                  ],
                },
              ],
            },
          ];
          saveEnvironmentContent(content);

          const stored = loadSavedEnvironmentContent();
          assert(stored.sections.length === 1);
          assert(stored.sections[0]?.coverImageId === "image-b");
          assert(stored.sections[0]?.rooms.length === 2);
          assert(stored.sections[0]?.rooms[0]?.images[0]?.imageId === "image-a");
          assert(stored.sections[0]?.rooms[0]?.images[1]?.imageId === "image-b");
          assert(stored.sections[0]?.rooms[1]?.images[0]?.imageId === "image-c");
          assert(stored.sections[0]?.rooms[0]?.images[1]?.focalPoint.x === 76);
        }),
      );
    },
  },
  {
    name: "environment content legacy zone data migrates into a default room and preserves images",
    run() {
      const migrated = normalizeEnvironmentContent({
        version: 1,
        intro: "旧环境说明",
        imageAspectRatio: { width: 16, height: 9 },
        zones: [
          {
            id: "legacy-zone",
            name: "旧分区",
            area: "约 12㎡",
            description: "旧说明",
            images: [
              { id: "legacy-zone-image-a", imageId: "legacy-a", focalPoint: { x: 10, y: 20 } },
              { id: "legacy-zone-image-b", imageId: "legacy-b", focalPoint: { x: 80, y: 70 } },
            ],
          },
        ],
      });
      assert(migrated.sections.length === 1);
      assert(migrated.sections[0]?.title === "旧分区");
      assert(migrated.sections[0]?.meta === "约 12㎡");
      assert(migrated.sections[0]?.summary === "旧说明");
      assert(migrated.sections[0]?.rooms.length === 1);
      assert(migrated.sections[0]?.rooms[0]?.title === "环境展示");
      assert(migrated.sections[0]?.rooms[0]?.images.length === 2);
      assert(migrated.sections[0]?.rooms[0]?.images[0]?.imageId === "legacy-a");
      assert(migrated.sections[0]?.rooms[0]?.images[1]?.imageId === "legacy-b");
    },
  },
  {
    name: "environment draft preview stays isolated from saved content",
    run() {
      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          const saved = cloneEnvironmentContent();
          saved.sections[0]!.summary = "已保存环境摘要";
          saveEnvironmentContent(saved);

          const draft = cloneEnvironmentContent();
          draft.sections[0]!.summary = "草稿环境摘要";
          draft.sections[0]!.rooms[0]!.images = [
            {
              id: "draft-room-image-1",
              imageId: "draft-image-a",
              focalPoint: { x: 50, y: 50 },
            },
          ];
          saveDraftPreviewEnvironmentContent(draft);

          assert(loadSavedEnvironmentContent().sections[0]?.summary === "已保存环境摘要");
          assert(loadDraftPreviewEnvironmentContent().sections[0]?.summary === "草稿环境摘要");
          assert(
            loadDraftPreviewEnvironmentContent().sections[0]?.rooms[0]?.images[0]?.imageId ===
              "draft-image-a",
          );
        },
      );
    },
  },
  {
    name: "environment room deletion keeps sibling rooms and image order intact",
    run() {
      withCustomEvent(() =>
        withWindowObject(createEventWindow({ localStorage: createStorage(null) }), () => {
          const content = cloneEnvironmentContent();
          content.sections = [
            {
              id: "environment-section-delete",
              title: "待删测试",
              summary: "删除房间",
              meta: "2 个房间",
              rooms: [
                {
                  id: "keep-room",
                  title: "保留房间",
                  description: "保留",
                  images: [
                    { id: "keep-room-image-1", imageId: "keep-a", focalPoint: { x: 11, y: 22 } },
                    { id: "keep-room-image-2", imageId: "keep-b", focalPoint: { x: 33, y: 44 } },
                  ],
                },
                {
                  id: "remove-room",
                  title: "删除房间",
                  description: "删除",
                  images: [
                    {
                      id: "remove-room-image-1",
                      imageId: "remove-a",
                      focalPoint: { x: 66, y: 77 },
                    },
                  ],
                },
              ],
            },
          ];
          saveEnvironmentContent(content);

          const updated = loadSavedEnvironmentContent();
          updated.sections[0]!.rooms = updated.sections[0]!.rooms.filter(
            (room) => room.id !== "remove-room",
          );
          saveEnvironmentContent(updated);

          const stored = loadSavedEnvironmentContent();
          assert(stored.sections[0]?.rooms.length === 1);
          assert(stored.sections[0]?.rooms[0]?.id === "keep-room");
          assert(stored.sections[0]?.rooms[0]?.images.length === 2);
          assert(stored.sections[0]?.rooms[0]?.images[0]?.imageId === "keep-a");
          assert(stored.sections[0]?.rooms[0]?.images[1]?.imageId === "keep-b");
        }),
      );
    },
  },
  {
    name: "aftercare contract file persists and saved subscribers stay in sync",
    run() {
      withCustomEvent(() =>
        withWindowObject(createEventWindow({ localStorage: createStorage(null) }), () => {
          const content = cloneAftercareContent();
          content.contractFile = {
            title: "2026 购猫合同",
            assetId: "site-page-aftercare-contract-asset-demo",
            fileName: "contract-demo.pdf",
            mimeType: "application/pdf",
          };

          let callbackCount = 0;
          const unsubscribe = subscribeToSavedAftercareContent(() => {
            callbackCount += 1;
          });

          saveAftercareContent(content);
          const stored = loadSavedAftercareContent();
          unsubscribe();

          assert(callbackCount === 1);
          assert(stored.contractFile.title === "2026 购猫合同");
          assert(stored.contractFile.assetId === "site-page-aftercare-contract-asset-demo");
          assert(stored.contractFile.fileName === "contract-demo.pdf");
          assert(stored.contractFile.mimeType === "application/pdf");
        }),
      );
    },
  },
  {
    name: "site page asset helpers support contract file save read and delete",
    async run() {
      await withWindowObject(
        createEventWindow({
          indexedDB: createFakeIndexedDb(),
          crypto: { randomUUID: () => "contract-asset" },
        }),
        async () => {
          const file = new File(["pdf"], "contract.pdf", { type: "application/pdf" });
          const record = await saveSitePageAsset("aftercare-contract", file);

          assert(record.id === "site-page-aftercare-contract-asset-contract-asset");
          assert((await getSitePageAssetBlob(record.id)) === file);
          assert(await deleteSitePageAssetBlob(record.id));
          assert((await getSitePageAssetBlob(record.id)) === null);
        },
      );
    },
  },
  {
    name: "questionnaire submission stores full answers and latest-first ordering",
    run() {
      resetCatteryDataForTests();
      const beforeCount = selectQuestionnaireSubmissions().length;
      const result = catteryActions.submitQuestionnaire({
        content: cloneQuestionnaireContent(),
        values: {
          name: "2026-07-26 浏览器验收 A",
          gender: "female",
          phone: "13812345678",
          age: "29",
          job: "设计师",
          city: "上海",
          experience: "yes",
          residents: "yes",
          residentsNeutered: "neutered",
          hasKids: "no",
          housing: "owned",
          windowSealed: "sealed",
          familyAgree: "allAgree",
          wantGender: "female",
          wantColor: "银虎斑",
          budget: "2w-3w",
          acceptNeuter: "accept",
          monthlySpend: "500to1000",
          scientificFeeding: "accept",
          acceptActive: "accept",
          commitment: "accept",
        },
      });
      const submissions = selectQuestionnaireSubmissions();
      const created = submissions.find((submission) => submission.id === result.id);

      assert(result.created);
      assert(typeof result.id === "string");
      assert(submissions.length === beforeCount + 1);
      assert(submissions[0]?.id === result.id);
      assert(created?.status === "未查看");
      assert(created?.answers.name.value === "2026-07-26 浏览器验收 A");
      assert(created?.answers.gender.type === "choice");
      assert(created?.answers.gender.value === "female");
      assert(created?.answers.gender.label === "女");
      assert(created?.answers.phone.value === "13812345678");
      assert(created?.answers.residents.value === "yes");
      assert(created?.answers.residentsNeutered.value === "neutered");
      assert(created?.answers.wantColor.value === "银虎斑");
      assert(created?.answers.commitment.value === "accept");
    },
  },
  {
    name: "questionnaire submission dedupe blocks duplicate same-page triggers but allows new ids",
    run() {
      resetCatteryDataForTests();
      const values = {
        name: "2026-07-26 浏览器验收 B",
        gender: "male",
        phone: "13912345678",
        age: "31",
        job: "开发",
        city: "杭州",
        experience: "no",
        residents: "no",
        residentsNeutered: "neutered",
        hasKids: "yes",
        housing: "rentApproved",
        windowSealed: "canSeal",
        familyAgree: "allAgree",
        wantGender: "either",
        wantColor: "棕虎斑",
        budget: "1w-2w",
        acceptNeuter: "accept",
        monthlySpend: "300to500",
        scientificFeeding: "needMoreInfo",
        acceptActive: "accept",
        commitment: "accept",
      } as const;

      const first = catteryActions.submitQuestionnaire({
        content: cloneQuestionnaireContent(),
        values,
      });
      const second = catteryActions.submitQuestionnaire({
        content: cloneQuestionnaireContent(),
        values,
      });
      const third = catteryActions.submitQuestionnaire({
        content: cloneQuestionnaireContent(),
        values: { ...values, budget: "2w-3w" },
      });
      const submissions = selectQuestionnaireSubmissions();
      const firstRecord = submissions.find((submission) => submission.id === first.id);

      assert(first.created);
      assert(!second.created);
      assert(first.id === second.id);
      assert(third.created);
      assert(third.id !== first.id);
      assert(
        submissions.filter((submission) => submission.answers.name.value === values.name).length ===
          2,
      );
      assert(firstRecord?.answers.residents.value === "no");
      assert(firstRecord?.answers.residentsNeutered.value === "");
    },
  },
  {
    name: "questionnaire status note and refresh compatibility persist in browser-local storage",
    run() {
      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          resetCatteryDataForTests();
          const created = catteryActions.submitQuestionnaire({
            content: cloneQuestionnaireContent(),
            values: {
              name: "2026-07-26 浏览器验收 C",
              gender: "female",
              phone: "13712345678",
              age: "27",
              job: "运营",
              city: "南京",
              experience: "yes",
              residents: "yes",
              residentsNeutered: "partiallyNeutered",
              hasKids: "no",
              housing: "owned",
              windowSealed: "sealed",
              familyAgree: "allAgree",
              wantGender: "currentCat",
              wantColor: "都可以",
              budget: "可根据小猫情况沟通",
              acceptNeuter: "accept",
              monthlySpend: "over1000",
              scientificFeeding: "accept",
              acceptActive: "needMoreInfo",
              commitment: "accept",
            },
          });
          assert(catteryActions.updateQuestionnaireSubmissionStatus(created.id, "已联系"));
          assert(
            catteryActions.updateQuestionnaireSubmissionAdminNote(
              created.id,
              "2026-07-26 18:30 已电话联系，等待补充视频。",
            ),
          );

          const stored = loadSavedCatteryData();
          const storedRecord = stored.questionnaireSubmissions.find(
            (submission) => submission.id === created.id,
          );
          assert(storedRecord?.status === "已联系");
          assert(storedRecord?.adminNote === "2026-07-26 18:30 已电话联系，等待补充视频。");

          resetCatteryDataForTests();
          assert(
            !selectQuestionnaireSubmissions().some((submission) => submission.id === created.id),
          );
          hydrateCatteryDataFromStorage();
          const rehydrated = selectQuestionnaireSubmissions().find(
            (submission) => submission.id === created.id,
          );
          assert(rehydrated?.status === "已联系");
          assert(rehydrated?.adminNote === "2026-07-26 18:30 已电话联系，等待补充视频。");
        },
      );
    },
  },
  {
    name: "missing questionnaire field backfills safely without dropping other saved data",
    run() {
      const base = cloneDefaultCatteryData();
      const raw: Partial<CatteryData> = {
        version: 1,
        users: [
          ...base.users,
          { id: "parent-questionnaire", name: "Questionnaire 家长", role: "parent" },
        ],
        cats: [
          ...base.cats,
          {
            id: "cat-questionnaire",
            kind: "family",
            name: "Questionnaire Cat",
            ownerId: "parent-questionnaire",
            galleryImageIds: [],
            visibility: "visible",
          },
        ],
        litters: base.litters,
        posts: [
          ...base.posts,
          {
            id: "p-questionnaire",
            authorId: "parent-questionnaire",
            authorName: "Questionnaire 家长",
            authorRole: "星月家长",
            category: "家长分享",
            content: "Questionnaire post preserved",
            imageCount: 0,
            catIds: ["cat-questionnaire"],
            createdAt: "2026-07-20T10:00:00",
            likes: 0,
            likedByMe: false,
            comments: [],
          },
        ],
      };

      const migrated = normalizeCatteryData(raw);
      assert(migrated.questionnaireSubmissions.length === base.questionnaireSubmissions.length);
      assert(migrated.users.some((user) => user.id === "parent-questionnaire"));
      assert(migrated.cats.some((cat) => cat.id === "cat-questionnaire"));
      assert(migrated.posts.some((post) => post.id === "p-questionnaire"));
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
    name: "hydrate helper restores default stud real-photo assignments into legacy saved snapshots",
    run() {
      resetCatteryDataForTests();
      const saved = cloneDefaultCatteryData();
      const savedLuoyiyi = saved.cats.find((cat) => cat.id === "luoyiyi");
      assert(savedLuoyiyi && savedLuoyiyi.kind === "stud");
      savedLuoyiyi.coverImageId = undefined;
      savedLuoyiyi.galleryImageIds = [];

      withWindowObject(
        {
          localStorage: createStorage(JSON.stringify(saved)),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          hydrateCatteryDataFromStorage();
          const hydrated = selectStudRecords(undefined, "all").find(
            (stud) => stud.id === "luoyiyi",
          );
          assert(hydrated?.coverImageId === "static:studs/luoyiyi/cover");
          assert(
            JSON.stringify(hydrated?.galleryImageIds) ===
              JSON.stringify(["static:studs/luoyiyi/gallery-1", "static:studs/luoyiyi/gallery-2"]),
          );
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
    name: "keeper moderation context works without changing the community session",
    run() {
      resetCatteryDataForTests();
      communityActions.logout();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };

      assert(catteryActions.togglePin("p-2", keeper) === true);
      assert(getCatteryDataSnapshot().posts.find((post) => post.id === "p-2")?.pinned === true);
      assert(catteryActions.toggleHidePost("p-2", keeper) === true);
      assert(getCatteryDataSnapshot().posts.find((post) => post.id === "p-2")?.hidden === true);
      assert(catteryActions.toggleHideComment("p-2", "c-2", keeper) === true);
      assert(
        getCatteryDataSnapshot()
          .posts.find((post) => post.id === "p-2")
          ?.comments.find((comment) => comment.id === "c-2")?.hidden === true,
      );
      assert(catteryActions.deleteComment("p-2", "c-2", keeper) === true);
      assert(
        !getCatteryDataSnapshot()
          .posts.find((post) => post.id === "p-2")
          ?.comments.some((comment) => comment.id === "c-2"),
      );

      const postId = catteryActions.createPost(
        {
          category: "猫舍日常",
          content: "后台主理人验收动态",
          imageCount: 0,
          catIds: ["chonglou"],
        },
        keeper,
      );
      assert(typeof postId === "string");
      assert(catteryActions.deletePost(postId, keeper) === true);
      assert(!getCatteryDataSnapshot().posts.some((post) => post.id === postId));

      assert(communityActions.togglePin("p-3") === false);
      assert(communityActions.deletePost("p-3") === false);
    },
  },
  {
    name: "keeper parent management enforces invite rules and persists stable ids",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };
      const beforeUserCount = getCatteryDataSnapshot().users.length;

      assert(
        catteryActions.createParent({ name: "空邀请码家长", inviteCode: "   " }, keeper) === null,
      );
      assert(
        catteryActions.createParent(
          { name: "重复邀请码家长", inviteCode: "XY-TOAST-2025" },
          keeper,
        ) === null,
      );

      const parentId = catteryActions.createParent(
        {
          name: "验收家长",
          inviteCode: "QA-PARENT-2026",
          note: "新增备注",
        },
        keeper,
      );
      assert(typeof parentId === "string");
      assert(getCatteryDataSnapshot().users.length === beforeUserCount + 1);

      const createdUser = getCatteryDataSnapshot().users.find((user) => user.id === parentId);
      assert(createdUser?.activatedAt);
      assert(createdUser?.active === true);
      assert(createdUser?.inviteCode === "QA-PARENT-2026");
      assert(createdUser?.note === "新增备注");

      assert(
        catteryActions.updateParent(
          parentId,
          { name: "验收家长改名", inviteCode: "XY-HUHU-2025" },
          keeper,
        ) === false,
      );
      assert(
        catteryActions.updateParent(
          parentId,
          { name: "验收家长改名", inviteCode: "QA-PARENT-2026-UPDATED", note: "" },
          keeper,
        ) === true,
      );

      const updatedUser = getCatteryDataSnapshot().users.find((user) => user.id === parentId);
      assert(updatedUser?.id === parentId);
      assert(updatedUser?.name === "验收家长改名");
      assert(updatedUser?.inviteCode === "QA-PARENT-2026-UPDATED");
      assert(updatedUser?.note === undefined);
      assert(updatedUser?.active === true);
    },
  },
  {
    name: "parent rename updates selectors and post authors without breaking owner links",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };

      const kittenId = catteryActions.addKitten(
        {
          name: "家长联动测试猫",
          gender: "弟弟",
          color: "银虎斑加白",
          birthday: "2026-07-25",
          ownerId: "parent-toast",
          personality: "验证 ownerName",
          kitten: {
            status: "待找家",
            price: "18888",
          },
        },
        keeper,
      );
      assert(typeof kittenId === "string");

      const beforeOwnedCatIds = getCatteryDataSnapshot()
        .cats.filter((cat) => cat.ownerId === "parent-toast")
        .map((cat) => cat.id)
        .sort();
      assert(
        catteryActions.updateParent(
          "parent-toast",
          {
            name: "吐司的新家长昵称",
            inviteCode: "XY-TOAST-2026",
            note: "已更新备注",
          },
          keeper,
        ) === true,
      );

      const afterOwnedCatIds = getCatteryDataSnapshot()
        .cats.filter((cat) => cat.ownerId === "parent-toast")
        .map((cat) => cat.id)
        .sort();
      assert(JSON.stringify(beforeOwnedCatIds) === JSON.stringify(afterOwnedCatIds));

      const post = selectPosts().find((item) => item.id === "p-2");
      const kitten = selectKittenRecords(getCatteryDataSnapshot(), "all").find(
        (item) => item.id === kittenId,
      );
      assert(post?.authorId === "parent-toast");
      assert(post?.authorName === "吐司的新家长昵称");
      assert(kitten?.ownerId === "parent-toast");
      assert(kitten?.ownerName === "吐司的新家长昵称");
    },
  },
  {
    name: "disabled parent loses demo write access and regains it after re-enable",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };

      assert(communityActions.activateParent("XY-HUHU-2025") === true);
      assert(catteryActions.toggleParentActive("parent-huhu", keeper) === true);
      const disabledParent = getCatteryDataSnapshot().users.find(
        (user) => user.id === "parent-huhu",
      );
      assert(disabledParent?.activatedAt === "2026-02-04");
      assert(disabledParent?.active === false);
      assert(communityActions.activateParent("XY-HUHU-2025") === false);
      assert(
        communityActions.createPost({
          category: "家长分享",
          content: "停用后不应成功",
          imageCount: 0,
          catIds: ["cat-huhu"],
        }) === null,
      );
      assert(communityActions.updateCat("cat-huhu", { name: "停用后不应改名" }) === false);
      assert(
        getCatteryDataSnapshot().cats.find((cat) => cat.id === "cat-huhu")?.name !==
          "停用后不应改名",
      );

      assert(catteryActions.toggleParentActive("parent-huhu", keeper) === true);
      const reenabledParent = getCatteryDataSnapshot().users.find(
        (user) => user.id === "parent-huhu",
      );
      assert(reenabledParent?.activatedAt === "2026-02-04");
      assert(reenabledParent?.active === true);
      assert(communityActions.activateParent("XY-HUHU-2025") === true);
      const postId = communityActions.createPost({
        category: "家长分享",
        content: "恢复后重新可发布",
        imageCount: 0,
        catIds: ["cat-huhu"],
      });
      assert(typeof postId === "string");
      assert(communityActions.updateCat("cat-huhu", { name: "恢复后可改名" }) === true);
      assert(
        getCatteryDataSnapshot().cats.find((cat) => cat.id === "cat-huhu")?.name === "恢复后可改名",
      );
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
    name: "known semi-retired stud status migrates away from old wording",
    run() {
      const data = cloneDefaultCatteryData();
      const chonglou = data.cats.find((cat) => cat.id === "chonglou");
      assert(chonglou?.stud);
      chonglou.stud.status = "半退役 · 在舍";

      const migrated = normalizeCatteryData(data);
      assert(migrated.cats.find((cat) => cat.id === "chonglou")?.stud?.status === "半退役");
    },
  },
  {
    name: "keeper stud actions update persisted records and selectors",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };
      const studId = catteryActions.addStud(
        {
          name: "星河",
          gender: "弟弟",
          color: "蓝银虎斑",
          birthday: "2026-06-01",
          personality: "亲人",
          story: ["第一段介绍"],
          stud: {
            role: "现役公猫",
            category: "现役公猫",
            status: "在配",
            trait: "状态稳定",
            source: "自留",
            reproductiveState: "active",
          },
        },
        keeper,
      );
      assert(typeof studId === "string");
      assert(
        catteryActions.updateStud(
          studId,
          {
            name: "星河改名",
            visibility: "hidden",
            story: ["更新后的介绍"],
            stud: {
              role: "现役公猫 / 观察中",
              category: "现役公猫",
              status: "观察中",
              trait: "骨量好",
              source: "更新血线",
              reproductiveState: "preparing",
            },
          },
          keeper,
        ) === true,
      );
      assert(catteryActions.setCatVisibility(studId, "archived", keeper) === true);

      const snapshot = getCatteryDataSnapshot();
      const stud = snapshot.cats.find((cat) => cat.id === studId);
      const publicStuds = selectStudRecords(snapshot);
      const allStuds = selectStudRecords(snapshot, "all");
      assert(stud?.kind === "stud");
      assert(stud?.name === "星河改名");
      assert(stud?.visibility === "archived");
      assert(stud?.stud?.reproductiveState === "preparing");
      assert(!publicStuds.some((item) => item.id === studId));
      assert(allStuds.some((item) => item.id === studId && item.status === "观察中"));
    },
  },
  {
    name: "stud id links survive rename for kittens litters and posts",
    run() {
      resetCatteryDataForTests();
      const keeper = { role: "keeper" as const, currentUserId: "keeper-yueqi" };
      const fatherId = catteryActions.addStud(
        {
          name: "老父亲",
          gender: "弟弟",
          color: "黑银虎斑",
          stud: {
            role: "现役公猫",
            category: "现役公猫",
            status: "在配",
            trait: "稳重",
            source: "外引",
            reproductiveState: "active",
          },
        },
        keeper,
      );
      const motherId = catteryActions.addStud(
        {
          name: "老母亲",
          gender: "妹妹",
          color: "银玳瑁",
          stud: {
            role: "现役母猫",
            category: "现役母猫",
            status: "在舍",
            trait: "温柔",
            source: "自留",
            reproductiveState: "active",
          },
        },
        keeper,
      );
      assert(typeof fatherId === "string");
      assert(typeof motherId === "string");

      const litterId = catteryActions.addLitter(
        {
          name: "验证窝",
          birthDate: "2026-07-20",
          status: "成长记录中",
          fatherId,
          motherId,
        },
        keeper,
      );
      const kittenId = catteryActions.addKitten(
        {
          name: "小团子",
          gender: "妹妹",
          color: "银虎斑加白",
          birthday: "2026-07-21",
          personality: "活泼",
          kitten: {
            status: "待找家",
            price: "18888",
            litterId: litterId ?? undefined,
            fatherId: fatherId ?? undefined,
            motherId: motherId ?? undefined,
          },
        },
        keeper,
      );
      const postId = catteryActions.createPost(
        {
          category: "猫舍日常",
          content: "关联种猫验证",
          imageCount: 0,
          catIds: [fatherId],
          litterIds: litterId ? [litterId] : [],
        },
        keeper,
      );
      if (
        typeof fatherId !== "string" ||
        typeof motherId !== "string" ||
        typeof litterId !== "string" ||
        typeof kittenId !== "string" ||
        typeof postId !== "string"
      ) {
        throw new Error("expected keeper stud linkage setup to create all records");
      }
      assert(typeof litterId === "string");
      assert(typeof kittenId === "string");
      assert(typeof postId === "string");

      const father = getCatteryDataSnapshot().cats.find((cat) => cat.id === fatherId);
      assert(father?.stud);
      assert(
        catteryActions.updateStud(
          fatherId,
          {
            name: "改名后的父亲",
            color: "蓝银虎斑",
            stud: {
              ...father.stud,
              status: "观察中",
              trait: "改名后仍被关联",
              reproductiveState: "preparing",
            },
          },
          keeper,
        ) === true,
      );

      const snapshot = getCatteryDataSnapshot();
      const kitten = selectKittenRecords(snapshot, "all").find((item) => item.id === kittenId);
      const litter = selectLitterRecords(snapshot, "all").find((item) => item.id === litterId);
      const stud = selectStudRecords(snapshot, "all").find((item) => item.id === fatherId);
      const post = selectPosts(snapshot).find((item) => item.id === postId);
      assert(kitten?.fatherId === fatherId);
      assert(kitten?.fatherName === "改名后的父亲");
      assert(litter?.fatherId === fatherId);
      assert(litter?.fatherName === "改名后的父亲");
      assert(post?.catIds[0] === fatherId);
      assert(stud?.linkedKittenCount === 1);
      assert(stud?.linkedLitterCount === 1);
      assert(stud?.linkedPostCount === 1);
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
  {
    name: "confirmed stud colors and stories ship in default data by stable id",
    run() {
      const data = cloneDefaultCatteryData();
      const expectedStuds: Array<[string, string, number]> = [
        ["chonglou", "红虎斑（d22）", 5],
        ["hupo", "棕虎斑麻纹加白（n2509）", 5],
        ["shulongyin", "黑银鱼骨纹（高银）（ns23）", 6],
        ["tianhe", "银虎斑加白（ns2203）", 6],
        ["sanmingzhi", "棕虎斑（n22）", 5],
        ["yunmu", "黑银麻纹加白（ns2503）", 6],
        ["niaotuan", "银玳瑁虎斑（fs22）", 6],
        ["guihuagao", "玳瑁麻纹加白（f2509）", 5],
        ["zhaoyue", "黑银鱼骨纹（ns23）", 5],
        ["jingzhe", "蓝银虎斑（as22）", 8],
        ["xiongmao", "棕麻纹加白（n2509）", 6],
        ["yunyue", "银玳瑁虎斑（fs22）", 4],
        ["xiaoxiaxian", "银玳瑁麻纹（fs25）", 4],
        ["manao", "玳瑁虎斑加白（f2209）", 6],
        ["xiaobianmu", "玳瑁虎斑（f22）", 5],
        ["xiaotao", "玳瑁麻纹（f25）", 3],
      ];

      for (const [id, color, storyLength] of expectedStuds) {
        const stud = data.cats.find((cat) => cat.id === id);
        assert(stud?.kind === "stud");
        assert(stud.color === color);
        assert(stud.story?.length === storyLength);
      }

      assert(
        data.cats.find((cat) => cat.id === "niaotuan")?.story?.at(-1) ===
          "后续也会尝试更多搭配，保留长处、优化短板，让她的后代从小到大",
      );
      assert(data.cats.find((cat) => cat.id === "huqing")?.color === "示例文字（缺少颜色）");
      assert(
        data.cats.find((cat) => cat.id === "huqing")?.story?.[0] ===
          "（示例文字：主理人的完整介绍待补充）",
      );
      assert(data.cats.find((cat) => cat.id === "luoyiyi")?.color === "示例文字（缺少颜色）");
      assert(
        data.cats.find((cat) => cat.id === "luoyiyi")?.story?.[0] ===
          "（示例文字：主理人的完整介绍待补充）",
      );
    },
  },
  {
    name: "normalize backfills missing stud defaults without overwriting custom browser-local stories",
    run() {
      const data = cloneDefaultCatteryData();
      const hupo = data.cats.find((cat) => cat.id === "hupo");
      const chonglou = data.cats.find((cat) => cat.id === "chonglou");
      const xiongmao = data.cats.find((cat) => cat.id === "xiongmao");
      assert(hupo?.kind === "stud" && hupo.stud);
      assert(chonglou?.kind === "stud" && chonglou.stud);
      assert(xiongmao?.kind === "stud" && xiongmao.stud);

      hupo.color = "棕虎斑麻纹加白 n2509";
      hupo.story = undefined;
      hupo.stud.source = "示例文字（缺少来源 / 血线）";

      chonglou.color = "红虎斑 d22";
      chonglou.story = [
        "来自一家俄罗斯老牌猫舍，该猫舍主理人曾任国内 WCF 协会裁判，繁育的小猫结构细节都很出色。",
        "重楼头版强壮敦厚，额头饱满转折清晰，耳位端正耳朵又大又直，而且他也来自一条大体格血线，身体肌肉轮廓清晰强健有力，骨量优秀，体重接近二十斤，运动能力优秀，热爱跑跳和小猫玩。体检心脏、髋关节都很健康。",
        "与此同时他还有着非常温顺的性格，对人友好，喜欢陪小猫玩，对母猫也很温柔。",
        "他的风格比较符合我理想中甜美帅气结合的样子，尽管他身价不菲，但我还是毅然决然地接他回家。",
        "一转眼他已经打工四年啦，时间证明了结构优秀的种猫是不会过时的，他为我们留下了很多非常优秀的小猫。现在半退役生活在我家享受退役猫待遇，因为他不乱尿可以偶尔出来玩耍，在新房也给他准备了最大的公猫房~",
      ];

      xiongmao.color = "用户自定义颜色";
      xiongmao.story = ["用户写过的完整介绍"];
      xiongmao.stud.source = "用户自定义来源";

      const migrated = normalizeCatteryData(data);
      const migratedHupo = migrated.cats.find((cat) => cat.id === "hupo");
      const migratedChonglou = migrated.cats.find((cat) => cat.id === "chonglou");
      const migratedXiongmao = migrated.cats.find((cat) => cat.id === "xiongmao");
      assert(migratedHupo?.kind === "stud" && migratedHupo.stud);
      assert(migratedChonglou?.kind === "stud" && migratedChonglou.stud);
      assert(migratedXiongmao?.kind === "stud" && migratedXiongmao.stud);

      assert(migratedHupo.color === "棕虎斑麻纹加白（n2509）");
      assert(migratedHupo.story?.length === 5);
      assert(migratedHupo.stud.source === "国内知名老牌美血猫舍");

      assert(migratedChonglou.color === "红虎斑（d22）");
      assert(
        migratedChonglou.story?.[1] ===
          "重楼头版强壮敦厚，额头饱满、转折清晰，耳位端正，耳朵又大又直。而且他也来自一条大体格血线，身体肌肉轮廓清晰，强健有力，骨量优秀，体重接近二十斤。运动能力优秀，热爱跑跳和小猫玩，体检心脏、髋关节都很健康。",
      );

      assert(migratedXiongmao.color === "用户自定义颜色");
      assert(migratedXiongmao.story?.[0] === "用户写过的完整介绍");
      assert(migratedXiongmao.stud.source === "用户自定义来源");

      const migratedAgain = normalizeCatteryData(migrated);
      assert(JSON.stringify(migratedAgain) === JSON.stringify(migrated));
    },
  },
  {
    name: "normalize restores missing default stud records by stable id",
    run() {
      const base = cloneDefaultCatteryData();
      const trimmed: CatteryData = {
        ...base,
        cats: base.cats.filter((cat) => cat.id !== "hupo" && cat.id !== "xiaotao"),
      };

      const migrated = normalizeCatteryData(trimmed);
      assert(migrated.cats.some((cat) => cat.id === "hupo"));
      assert(migrated.cats.some((cat) => cat.id === "xiaotao"));
    },
  },
  {
    name: "real photo stud aliases map to existing stable ids without creating unknown cats",
    run() {
      const studs = selectStudRecords(cloneDefaultCatteryData(), "all");
      const luoyiyi = studs.find((stud) => stud.id === "luoyiyi");
      const xiaoxiaxian = studs.find((stud) => stud.id === "xiaoxiaxian");

      assert(luoyiyi?.coverImageId === "static:studs/luoyiyi/cover");
      assert(
        JSON.stringify(luoyiyi?.galleryImageIds) ===
          JSON.stringify(["static:studs/luoyiyi/gallery-1", "static:studs/luoyiyi/gallery-2"]),
      );
      assert(xiaoxiaxian?.coverImageId === "static:studs/xiaoxiaxian/cover");
      assert(
        JSON.stringify(xiaoxiaxian?.galleryImageIds) ===
          JSON.stringify([
            "static:studs/xiaoxiaxian/gallery-1",
            "static:studs/xiaoxiaxian/gallery-2",
          ]),
      );
      assert(!studs.some((stud) => stud.id === "kabi"));
      assert(!studs.some((stud) => stud.id === "luoshui"));
      assert(!studs.some((stud) => stud.id === "hongdou"));
      assert(!studs.some((stud) => stud.id === "zhongling"));
    },
  },
  {
    name: "manual cover presentations override fallback per entry and keep other entries isolated",
    run() {
      const manual = {
        listCard: {
          imageId: "static:studs/tianhe/cover",
          cropRect: { x: 0.1, y: 0.2, width: 0.6, height: 0.375 },
        },
      };

      const listCard = getResolvedCatCoverPresentation({
        catId: "tianhe",
        coverImageId: "static:studs/tianhe/cover",
        entry: "listCard",
        manualSelections: manual,
      });
      const breedingPlan = getResolvedCatCoverPresentation({
        catId: "tianhe",
        coverImageId: "static:studs/tianhe/cover",
        entry: "breedingPlanCard",
        manualSelections: manual,
      });

      assert(listCard.source === "manual");
      assert(listCard.mode === "crop");
      assert(listCard.cropRect.x === 0.1);
      assert(listCard.cropRect.height === 0.375);
      assert(breedingPlan.source === "fallback");
      assert(breedingPlan.mode === "legacy");
      assert(breedingPlan.imageId === "static:studs/tianhe/cover");
    },
  },
  {
    name: "detail carousel presentations resolve by stable image id and cover can fall back to legacy detail hero",
    run() {
      const manual = {
        "static:studs/tianhe/gallery-1": {
          mode: "crop" as const,
          aspectRatio: 4 / 3,
          cropRect: { x: 0.08, y: 0.1, width: 0.72, height: 0.6 },
        },
      };
      const legacyCover = {
        detailHero: { objectPositionX: 61, objectPositionY: 19, zoom: 1.33 },
      };

      const cover = getResolvedDetailCarouselPresentation({
        catId: "tianhe",
        imageId: "static:studs/tianhe/cover",
        coverImageId: "static:studs/tianhe/cover",
        manualPresentations: manual,
        legacyCoverPresentations: legacyCover,
      });
      const gallery = getResolvedDetailCarouselPresentation({
        catId: "tianhe",
        imageId: "static:studs/tianhe/gallery-1",
        coverImageId: "static:studs/tianhe/cover",
        manualPresentations: manual,
        legacyCoverPresentations: legacyCover,
      });
      const fallback = getResolvedDetailCarouselPresentation({
        catId: "tianhe",
        imageId: "static:studs/tianhe/gallery-2",
        coverImageId: "static:studs/tianhe/cover",
        manualPresentations: manual,
        legacyCoverPresentations: legacyCover,
      });

      assert(cover.source === "legacy");
      assert(cover.mode === "legacy");
      assert(cover.legacy.objectPositionX === 61);
      assert(gallery.source === "manual");
      assert(gallery.mode === "crop");
      assert(gallery.cropRect.width === 0.72);
      assert(gallery.aspectRatio === 4 / 3);
      assert(fallback.source === "fallback");
      assert(fallback.mode === "legacy");
      assert(fallback.legacy.zoom === 1);
      assert(fallback.legacy.objectPositionY !== cover.legacy.objectPositionY);
    },
  },
  {
    name: "cover presentations normalize safely and kitten records omit breeding plan entry",
    run() {
      const normalized = normalizeCatteryData({
        version: 1,
        users: cloneDefaultCatteryData().users,
        cats: [
          {
            id: "kitten-crop-check",
            kind: "kitten",
            name: "Kitten Crop",
            galleryImageIds: [],
            visibility: "visible",
            coverPresentations: {
              listCard: { objectPositionX: 12.4, objectPositionY: 150, zoom: 9 },
              breedingPlanCard: { objectPositionX: 80, objectPositionY: 20, zoom: 1.6 },
            },
            kitten: {
              status: "待找家",
              price: "",
            },
          },
          {
            id: "stud-crop-check",
            kind: "stud",
            name: "Stud Crop",
            galleryImageIds: [],
            visibility: "visible",
            coverPresentations: {
              listCard: { objectPositionX: -10, objectPositionY: 25, zoom: 0.4 },
              breedingPlanCard: { objectPositionX: 48, objectPositionY: 16, zoom: 1.52 },
            },
            stud: {
              role: "",
              category: "现役公猫",
              status: "在役",
              trait: "",
              source: "",
              reproductiveState: "active",
            },
          },
        ],
        litters: cloneDefaultCatteryData().litters,
        posts: cloneDefaultCatteryData().posts,
        questionnaireSubmissions: cloneDefaultCatteryData().questionnaireSubmissions,
      });

      const kitten = selectKittenRecords(normalized, "all").find(
        (item) => item.id === "kitten-crop-check",
      );
      const stud = selectStudRecords(normalized, "all").find(
        (item) => item.id === "stud-crop-check",
      );

      assert(kitten?.coverPresentations?.listCard?.objectPositionX === 12);
      assert(kitten?.coverPresentations?.listCard?.objectPositionY === 100);
      assert(kitten?.coverPresentations?.listCard?.zoom === 2.5);
      assert(!kitten?.coverPresentations?.breedingPlanCard);
      assert(stud?.coverPresentations?.listCard?.objectPositionX === 0);
      assert(stud?.coverPresentations?.listCard?.zoom === 1);
      assert(stud?.coverPresentations?.breedingPlanCard?.zoom === 1.52);
    },
  },
  {
    name: "saved cover presentations survive browser-local round trip and refresh",
    run() {
      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          resetCatteryDataForTests();
          assert(
            catteryActions.updateStud(
              "luoyiyi",
              {
                coverPresentations: {
                  listCard: { objectPositionX: 24, objectPositionY: 18, zoom: 1.11 },
                  detailHero: { objectPositionX: 55, objectPositionY: 22, zoom: 1.37 },
                  breedingPlanCard: { objectPositionX: 43, objectPositionY: 14, zoom: 1.52 },
                },
                detailCarouselPresentations: {
                  "static:studs/luoyiyi/cover": {
                    objectPositionX: 49,
                    objectPositionY: 16,
                    zoom: 1.28,
                  },
                  "static:studs/luoyiyi/gallery-2": {
                    objectPositionX: 62,
                    objectPositionY: 41,
                    zoom: 1.46,
                  },
                },
              },
              { role: "keeper", currentUserId: "keeper-yueqi" },
            ),
          );

          const stored = loadSavedCatteryData();
          const savedCat = stored.cats.find((cat) => cat.id === "luoyiyi");
          assert(savedCat?.coverPresentations?.detailHero?.zoom === 1.37);
          assert(
            savedCat?.detailCarouselPresentations?.["static:studs/luoyiyi/gallery-2"]?.zoom ===
              1.46,
          );

          resetCatteryDataForTests();
          hydrateCatteryDataFromStorage();
          const rehydrated = selectStudRecords(undefined, "all").find(
            (stud) => stud.id === "luoyiyi",
          );
          assert(rehydrated?.coverPresentations?.listCard?.objectPositionX === 24);
          assert(rehydrated?.coverPresentations?.breedingPlanCard?.objectPositionY === 14);
          assert(rehydrated?.coverPresentations?.detailHero?.zoom === 1.37);
          assert(
            rehydrated?.detailCarouselPresentations?.["static:studs/luoyiyi/cover"]
              ?.objectPositionY === 16,
          );
          assert(
            rehydrated?.detailCarouselPresentations?.["static:studs/luoyiyi/gallery-2"]?.zoom ===
              1.46,
          );
        },
      );
    },
  },
  {
    name: "saved entry cover selections survive browser-local round trip and refresh",
    run() {
      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          resetCatteryDataForTests();
          assert(
            catteryActions.updateStud(
              "luoyiyi",
              {
                entryCoverSelections: {
                  listCard: {
                    imageId: "static:studs/luoyiyi/cover",
                    cropRect: { x: 0.12, y: 0.18, width: 0.68, height: 0.42 },
                  },
                  breedingPlanCard: {
                    imageId: "static:studs/luoyiyi/gallery-1",
                    cropRect: { x: 0.1, y: 0.11, width: 0.82, height: 0.82 },
                  },
                  communityProfile: {
                    imageId: "static:studs/luoyiyi/gallery-2",
                    cropRect: { x: 0.08, y: 0.14, width: 0.72, height: 0.54 },
                  },
                },
              },
              { role: "keeper", currentUserId: "keeper-yueqi" },
            ),
          );

          const stored = loadSavedCatteryData();
          const savedCat = stored.cats.find((cat) => cat.id === "luoyiyi");
          const savedListCard = savedCat?.entryCoverSelections?.listCard;
          const savedBreedingPlan = savedCat?.entryCoverSelections?.breedingPlanCard;
          const savedCommunityProfile = savedCat?.entryCoverSelections?.communityProfile;
          assert(savedListCard?.imageId === "static:studs/luoyiyi/cover");
          assert(savedBreedingPlan?.imageId === "static:studs/luoyiyi/gallery-1");
          assert(savedCommunityProfile?.imageId === "static:studs/luoyiyi/gallery-2");
          assert(savedListCard?.cropRect?.x === 0.12);
          assert(savedBreedingPlan?.cropRect?.height === 0.82);
          assert(savedCommunityProfile?.cropRect?.width === 0.72);

          resetCatteryDataForTests();
          hydrateCatteryDataFromStorage();
          const rehydrated = selectStudRecords(undefined, "all").find(
            (stud) => stud.id === "luoyiyi",
          );
          const rehydratedListCard = rehydrated?.entryCoverSelections?.listCard;
          const rehydratedBreedingPlan = rehydrated?.entryCoverSelections?.breedingPlanCard;
          const rehydratedCommunityProfile = rehydrated?.entryCoverSelections?.communityProfile;
          assert(rehydratedListCard?.imageId === "static:studs/luoyiyi/cover");
          assert(rehydratedBreedingPlan?.imageId === "static:studs/luoyiyi/gallery-1");
          assert(rehydratedCommunityProfile?.imageId === "static:studs/luoyiyi/gallery-2");
          assert(rehydratedListCard?.cropRect?.x === 0.12);
          assert(rehydratedBreedingPlan?.cropRect?.height === 0.82);
          assert(rehydratedCommunityProfile?.cropRect?.width === 0.72);

          const normalized = normalizeCatteryData(stored);
          const normalizedCat = normalized.cats.find((cat) => cat.id === "luoyiyi");
          const normalizedCommunityProfile = normalizedCat?.entryCoverSelections?.communityProfile;
          assert(normalizedCommunityProfile?.imageId === "static:studs/luoyiyi/gallery-2");
        },
      );
    },
  },
  {
    name: "feeding legacy five modules migrate to three canonical modules and keep copy plus images",
    run() {
      const migrated = normalizeFeedingContent({
        version: 1,
        intro: "legacy intro",
        imageAspectRatio: { width: 4, height: 3 },
        modules: [
          {
            id: "feeding-module-cooked",
            title: "熟自制",
            body: "熟自制正文",
            images: [
              {
                id: "cooked-a",
                imageId: "static:feeding/cooked/custom",
                focalPoint: { x: 30, y: 40 },
              },
            ],
          },
          {
            id: "feeding-module-kibble",
            title: "猫粮",
            body: "猫粮正文",
            images: [{ id: "merged-a", imageId: "merged-a", focalPoint: { x: 50, y: 50 } }],
          },
          {
            id: "feeding-module-cans",
            title: "罐头",
            body: "罐头正文",
            images: [{ id: "shared-image", imageId: "shared-image", focalPoint: { x: 51, y: 52 } }],
          },
          {
            id: "feeding-module-freezedried",
            title: "冻干",
            body: "冻干正文",
            images: [
              { id: "shared-image-2", imageId: "shared-image", focalPoint: { x: 53, y: 54 } },
            ],
          },
          {
            id: "feeding-module-supplements",
            title: "保健品",
            body: "保健品正文",
            images: [{ id: "supp-a", imageId: "supp-a", focalPoint: { x: 60, y: 70 } }],
          },
        ],
      });

      assert(migrated.modules.length === 3);
      assert(migrated.modules[0]?.id === "feeding-module-cooked");
      assert(migrated.modules[1]?.id === "feeding-module-kibble");
      assert(migrated.modules[2]?.id === "feeding-module-supplements");
      assert(migrated.modules[1]?.title === "猫粮 · 罐头 · 冻干");
      assert(
        migrated.modules[1]?.body ===
          ["猫粮", "猫粮正文", "", "罐头", "罐头正文", "", "冻干", "冻干正文"].join("\n"),
      );
      assert(migrated.modules[1]?.images.length === 2);
      assert(migrated.modules[1]?.images[0]?.imageId === "merged-a");
      assert(migrated.modules[1]?.images[1]?.imageId === "shared-image");
      assert(migrated.modules[0]?.body === "熟自制正文");
      assert(migrated.modules[2]?.body === "保健品正文");

      const migratedAgain = normalizeFeedingContent(migrated);
      assert(JSON.stringify(migratedAgain) === JSON.stringify(migrated));
    },
  },
  {
    name: "feeding saved and draft preview stay isolated after three-module migration",
    run() {
      withWindowObject(
        {
          localStorage: createStorage(null),
          dispatchEvent() {},
          addEventListener() {},
          removeEventListener() {},
        },
        () => {
          const saved = cloneFeedingContent();
          saved.modules[1]!.body = "已保存合并模块";
          saveFeedingContent(saved);

          saveDraftPreviewFeedingContent({
            version: 1,
            intro: saved.intro,
            imageAspectRatio: saved.imageAspectRatio,
            modules: [
              {
                id: "feeding-module-cooked",
                title: "熟自制",
                body: "草稿熟自制",
                images: [],
              },
              {
                id: "feeding-module-kibble",
                title: "猫粮",
                body: "草稿猫粮",
                images: [],
              },
              {
                id: "feeding-module-cans",
                title: "罐头",
                body: "草稿罐头",
                images: [],
              },
              {
                id: "feeding-module-freezedried",
                title: "冻干",
                body: "草稿冻干",
                images: [],
              },
              {
                id: "feeding-module-supplements",
                title: "保健品",
                body: "草稿保健品",
                images: [],
              },
            ],
          });

          const storedSaved = loadSavedFeedingContent();
          const storedDraft = loadDraftPreviewFeedingContent();
          assert(storedSaved.modules.length === 3);
          assert(storedDraft.modules.length === 3);
          assert(storedSaved.modules[1]?.body === "已保存合并模块");
          assert(
            storedDraft.modules[1]?.body ===
              ["猫粮", "草稿猫粮", "", "罐头", "草稿罐头", "", "冻干", "草稿冻干"].join("\n"),
          );
          assert(storedDraft.modules[0]?.body === "草稿熟自制");
          assert(storedDraft.modules[2]?.body === "草稿保健品");
        },
      );
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
  const records = new Map<string, string>();
  return {
    value: initial,
    getItem(key: string) {
      return records.has(key) ? records.get(key)! : this.value;
    },
    setItem(key: string, value: string) {
      records.set(key, value);
      this.value = value;
    },
  };
}

function createEventWindow(overrides: Record<string, unknown>) {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    addEventListener(type: string, listener: (event: Event) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
    ...overrides,
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

function withCustomEvent<T>(run: () => T): T {
  const global = globalThis as Record<string, unknown>;
  const hadPrevious = "CustomEvent" in global;
  const previous = global.CustomEvent;

  if (!hadPrevious) {
    global.CustomEvent = class CustomEventPolyfill<TDetail = unknown> {
      type: string;
      detail?: TDetail;

      constructor(type: string, init?: { detail?: TDetail }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }

  try {
    return run();
  } finally {
    if (hadPrevious) {
      global.CustomEvent = previous;
    } else {
      Reflect.deleteProperty(global, "CustomEvent");
    }
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
