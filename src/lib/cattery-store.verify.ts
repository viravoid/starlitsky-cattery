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
