import type {
  CatData,
  CatListData,
  CommunityCommentData,
  CommunityPostCategory,
  CommunityPostData,
  CommunityPostListData,
  CommunityPostOptionsData,
  CurrentUserData,
  CreateCommunityPostRequest,
  DeleteCommunityPostMediaData,
  FixedPageData,
  ImageUploadData,
  MediaAssetData,
  MyCatData,
  MyCatListData,
  SelectionApplicationData,
  SubmitSelectionApplicationRequest,
  ToggleCommunityPostLikeData,
  UpdateCommunityPostRequest,
} from "@starlitsky/shared";

const now = "2026-09-15T00:00:00.000Z";
const imageBase = "../../assets/visual-qa";

const litters = [
  {
    id: "visual-litter-aurora",
    name: "星河 A 窝",
    status: "born",
    birthDate: "2026-07-18",
    expectedBirthDate: null,
    visibility: "visible",
  },
  {
    id: "visual-litter-moon",
    name: "月见 B 窝",
    status: "born",
    birthDate: "2026-08-12",
    expectedBirthDate: null,
    visibility: "visible",
  },
];

const father = {
  id: "visual-stud-king",
  name: "星河",
  gender: "male",
  color: "黑银虎斑",
  lifecycleStatus: "breeding",
  visibility: "visible",
};

const mother = {
  id: "visual-stud-queen",
  name: "月见",
  gender: "female",
  color: "蓝银虎斑",
  lifecycleStatus: "breeding",
  visibility: "visible",
};

export function listVisualQaCats(): CatListData {
  return paginate(cats);
}

export function getVisualQaCat(id: string) {
  const cat = cats.find((item) => item.id === id);
  if (!cat) throw new Error("Visual QA fixture cat not found");
  return cat;
}

export function listVisualQaCommunityPosts(params: {
  category?: CommunityPostCategory | string;
  litterId?: string;
} = {}): CommunityPostListData {
  const items = posts.filter(
    (post) =>
      (!params.category || post.category === params.category) &&
      (!params.litterId || post.litters.some((litter) => litter.id === params.litterId)),
  );
  return paginate(items);
}

export function getVisualQaCommunityPost(id: string) {
  const post = posts.find((item) => item.id === id);
  if (!post) throw new Error("Visual QA fixture post not found");
  return post;
}

export function getVisualQaCurrentUser(): CurrentUserData {
  return {
    id: "visual-parent-user",
    nickname: "Visual QA 家长",
    avatarUrl: null,
    status: "active",
    roles: ["parent"],
    currentRole: "parent",
    parentProfile: {
      id: "visual-parent-profile",
      displayName: "Visual QA 家长",
      status: "active",
      activatedAt: now,
    },
  };
}

export function listVisualQaMyCats(params: { pageSize?: number } = {}): MyCatListData {
  return paginate(myCats.slice(0, params.pageSize ?? myCats.length));
}

export function getVisualQaMyCat(id: string): MyCatData {
  const cat = myCats.find((item) => item.id === id);
  if (!cat) throw new Error("Visual QA fixture my cat not found");
  return cat;
}

export function getVisualQaCommunityPostOptions(): CommunityPostOptionsData {
  return {
    categories: ["cattery_daily", "personal_thoughts", "parent_share"],
    cats: cats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      gender: cat.gender,
      color: cat.color,
      lifecycleStatus: cat.lifecycleStatus,
      visibility: cat.visibility,
    })),
    litters,
  };
}

export function createVisualQaCommunityPost(input: CreateCommunityPostRequest): CommunityPostData {
  return visualQaPostFromInput("visual-post-local", input, {
    canDelete: true,
    canEdit: true,
  });
}

export function updateVisualQaCommunityPost(
  id: string,
  input: UpdateCommunityPostRequest,
): CommunityPostData {
  const existing = posts.find((post) => post.id === id);
  if (!existing) {
    return visualQaPostFromInput(
      id,
      {
        category: input.category || "personal_thoughts",
        content: input.content || "Visual QA 本地编辑动态。",
        catIds: input.catIds,
        litterIds: input.litterIds,
      },
      { canDelete: true, canEdit: true },
    );
  }
  return {
    ...existing,
    category: input.category || existing.category,
    content: input.content || existing.content,
    cats: resolvePostCats(input.catIds) ?? existing.cats,
    litters: resolvePostLitters(input.litterIds) ?? existing.litters,
    updatedAt: now,
    canDelete: true,
    canEdit: true,
  };
}

export function deleteVisualQaCommunityPost(id: string): CommunityPostData {
  const existing = posts.find((post) => post.id === id);
  return existing
    ? { ...existing, canDelete: true }
    : visualQaPostFromInput(
        id,
        { category: "personal_thoughts", content: "Visual QA 本地删除动态。" },
        { canDelete: true },
      );
}

export function toggleVisualQaCommunityPostLike(id: string): ToggleCommunityPostLikeData {
  const existing = posts.find((post) => post.id === id);
  const liked = !(existing?.likedByMe ?? false);
  return {
    liked,
    likeCount: Math.max(0, (existing?.likeCount ?? 0) + (liked ? 1 : -1)),
  };
}

export function createVisualQaCommunityComment(
  postId: string,
  content: string,
): CommunityCommentData {
  return {
    id: `visual-comment-${Date.now()}`,
    postId,
    authorName: "Visual QA",
    authorRole: "user",
    content,
    visibility: "visible",
    canDelete: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function deleteVisualQaCommunityComment(
  postId: string,
  commentId: string,
): CommunityCommentData {
  return {
    id: commentId,
    postId,
    authorName: "Visual QA",
    authorRole: "user",
    content: "Visual QA 本地删除评论。",
    visibility: "visible",
    canDelete: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: now,
  };
}

export function requestVisualQaCommunityPostImageUpload(
  postId: string,
  input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    title?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
    usage?: string;
    sortOrder?: number;
  },
): ImageUploadData {
  const media = visualQaMediaAsset(postId, `visual-media-${Date.now()}`, input);
  return {
    media,
    upload: {
      method: "PUT",
      url: "visualqa://local-upload",
      headers: {},
      expiresAt: now,
      expiresInSeconds: 0,
    },
    objectKey: `visual-qa/${media.id}`,
    publicUrl: media.sourceUrl,
  };
}

export function completeVisualQaCommunityPostImageUpload(
  postId: string,
  mediaId: string,
): MediaAssetData {
  return visualQaMediaAsset(postId, mediaId, {
    fileName: "visual-qa-upload.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 0,
  });
}

export function deleteVisualQaCommunityPostImage(
  postId: string,
  mediaId: string,
): DeleteCommunityPostMediaData {
  return {
    id: mediaId,
    bindingId: `visual-binding-${mediaId}`,
    ownerType: "post",
    ownerId: postId,
    deletedAt: now,
  };
}

export function submitVisualQaSelectionApplication(
  input: SubmitSelectionApplicationRequest,
): SelectionApplicationData {
  return {
    id: `visual-selection-${Date.now()}`,
    userId: null,
    contactName: input.name,
    contactGender: input.gender,
    contactPhone: input.phone,
    contactAge: input.age,
    contactJob: input.job,
    contactCity: input.city,
    catExperience: { experience: input.experience },
    existingPets: {
      residents: input.residents,
      residentsNeutered: input.residentsNeutered || null,
    },
    livingEnvironment: {
      hasKids: input.hasKids,
      housing: input.housing,
      windowSealed: input.windowSealed,
      familyAgree: input.familyAgree,
    },
    maineCoonKnowledge: input.maineCoonKnowledge || null,
    preferences: {
      wantGender: input.wantGender,
      wantColor: input.wantColor,
      budget: input.budget,
      monthlySpend: input.monthlySpend,
    },
    commitments: {
      acceptNeuter: input.acceptNeuter,
      scientificFeeding: input.scientificFeeding,
      acceptActive: input.acceptActive,
      commitment: input.commitment,
    },
    additionalNote: input.additionalNote || null,
    status: "submitted",
    submittedAt: now,
    adminNote: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
    user: null,
    reviewedBy: null,
  };
}

export function getVisualQaFixedPage(slug: string): FixedPageData {
  const title = fixedPageTitles[slug] ?? "内容";
  return {
    id: `visual-fixed-${slug}`,
    slug: slug as FixedPageData["slug"],
    title,
    status: "published",
    seoTitle: null,
    seoDescription: null,
    contentSchemaVersion: 1,
    contentJson: {},
    publishedAt: now,
    mediaAssets: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

const fixedPageTitles: Record<string, string> = {
  about: "猫舍介绍",
  aftercare: "售后保障",
  "breeding-plan": "繁育计划",
  contact: "联系方式",
  environment: "猫舍环境",
  feeding: "喂养体系",
  philosophy: "繁育理念",
  process: "价格与接猫流程",
};

function visualQaPostFromInput(
  id: string,
  input: CreateCommunityPostRequest,
  permissions: { canDelete?: boolean; canEdit?: boolean } = {},
): CommunityPostData {
  return {
    id,
    authorName: "Visual QA",
    authorRole: "keeper",
    category: input.category,
    content: input.content,
    visibility: input.visibility || "visible",
    pinned: Boolean(input.pinned),
    cats: resolvePostCats(input.catIds) ?? [],
    litters: resolvePostLitters(input.litterIds) ?? [],
    mediaAssets: [],
    comments: [],
    commentCount: 0,
    likeCount: 0,
    likedByMe: false,
    canEdit: Boolean(permissions.canEdit),
    canDelete: Boolean(permissions.canDelete),
    createdAt: now,
    updatedAt: now,
  };
}

function resolvePostCats(ids?: string[]) {
  if (!ids) return null;
  return cats
    .filter((cat) => ids.includes(cat.id))
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      gender: cat.gender,
      color: cat.color,
      lifecycleStatus: cat.lifecycleStatus,
      visibility: cat.visibility,
    }));
}

function resolvePostLitters(ids?: string[]) {
  if (!ids) return null;
  return litters.filter((litter) => ids.includes(litter.id));
}

function visualQaMediaAsset(
  postId: string,
  mediaId: string,
  input: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    title?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
    usage?: string;
    sortOrder?: number;
  },
): MediaAssetData {
  return {
    id: mediaId,
    kind: "image",
    sourceUrl: `${imageBase}/kitten-available.png`,
    storedSourceUrl: `${imageBase}/kitten-available.png`,
    thumbnailUrl: `${imageBase}/kitten-available.png`,
    title: input.title || input.fileName,
    altText: input.altText || input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    width: input.width ?? null,
    height: input.height ?? null,
    durationSeconds: null,
    checksum: null,
    status: "ready",
    metadataJson: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    bindings: [
      {
        id: `visual-binding-${mediaId}`,
        mediaId,
        ownerType: "post",
        ownerId: postId,
        usage: input.usage || "gallery",
        sortOrder: input.sortOrder ?? 0,
        visibility: "visible",
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
  };
}

function cat(input: {
  birthday: string;
  color: string;
  gender: string;
  id: string;
  image: string;
  lifecycleStatus: string;
  name: string;
  personality: string;
  story: string[];
  breeding?: {
    category: string;
    reproductiveState: string;
    statusLabel: string;
    trait: string;
    source: string;
    sortOrder: number;
  };
  kitten?: {
    litterId: string;
    litterName: string;
    priceText: string;
    saleStatus: string;
  };
}): CatData {
  return {
    id: input.id,
    name: input.name,
    gender: input.gender,
    color: input.color,
    birthday: input.birthday,
    lifecycleStatus: input.lifecycleStatus,
    personality: input.personality,
    storyJson: { story: input.story },
    visibility: "visible",
    breedingProfile: input.breeding
      ? {
          catId: input.id,
          category: input.breeding.category,
          reproductiveState: input.breeding.reproductiveState,
          statusLabel: input.breeding.statusLabel,
          trait: input.breeding.trait,
          source: input.breeding.source,
          sortOrder: input.breeding.sortOrder,
        }
      : null,
    kittenProfile: input.kitten
      ? {
          catId: input.id,
          litterId: input.kitten.litterId,
          saleStatus: input.kitten.saleStatus,
          priceText: input.kitten.priceText,
          structureRatingJson: {
            face: { eyes: 5, ears: 5, muzzle: 4, profile: 5 },
            body: { length: 5, build: 4, overall: 5 },
          },
          adoptedAt: input.kitten.saleStatus === "adopted" ? "2026-09-01T00:00:00.000Z" : null,
          litter: {
            id: input.kitten.litterId,
            name: input.kitten.litterName,
            status: "born",
            fatherCatId: father.id,
            motherCatId: mother.id,
            fatherCat: father,
            motherCat: mother,
          },
        }
      : null,
    mediaAssets: [0, 1, 2].map((index) => ({
      id: `${input.id}-image-${index + 1}`,
      kind: "image",
      sourceUrl: `${imageBase}/${input.image}`,
      thumbnailUrl: `${imageBase}/${input.image}`,
      title: `${input.name} Visual QA ${index + 1}`,
      altText: input.name,
      usage: index === 0 ? "cover" : "gallery",
      sortOrder: index,
    })),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

const cats: CatData[] = [
  cat({
    id: "visual-kitten-available",
    name: "云朵",
    gender: "female",
    color: "蓝银虎斑加白",
    birthday: "2026-07-18",
    lifecycleStatus: "growing",
    image: "kitten-available.png",
    personality: "亲人、胆大，会主动贴贴。",
    story: ["云朵是 Visual QA 待找家小猫，用于检查列表、详情、结构评分和问卷入口。"],
    kitten: {
      litterId: "visual-litter-aurora",
      litterName: "星河 A 窝",
      priceText: "沟通确认",
      saleStatus: "available",
    },
  }),
  cat({
    id: "visual-kitten-reserved",
    name: "奶糖",
    gender: "male",
    color: "黑银虎斑",
    birthday: "2026-07-18",
    lifecycleStatus: "growing",
    image: "kitten-reserved.png",
    personality: "稳定、爱玩，适合有陪伴时间的家庭。",
    story: ["奶糖覆盖找家中状态，方便人工验收状态筛选与详情状态 pill。"],
    kitten: {
      litterId: "visual-litter-aurora",
      litterName: "星河 A 窝",
      priceText: "已预留",
      saleStatus: "reserved",
    },
  }),
  cat({
    id: "visual-kitten-adopted",
    name: "松子",
    gender: "female",
    color: "银虎斑",
    birthday: "2026-08-12",
    lifecycleStatus: "adopted",
    image: "kitten-adopted.png",
    personality: "温和、慢热，已经去新家。",
    story: ["松子覆盖已有家状态，确保空 production 数据时也能验收完整状态集合。"],
    kitten: {
      litterId: "visual-litter-moon",
      litterName: "月见 B 窝",
      priceText: "已有家",
      saleStatus: "adopted",
    },
  }),
  cat({
    id: "visual-stud-king",
    name: "星河",
    gender: "male",
    color: "黑银虎斑",
    birthday: "2023-03-11",
    lifecycleStatus: "breeding",
    image: "stud-king.png",
    personality: "骨量稳定，脸版开阔。",
    story: ["星河覆盖现役公猫详情，用于验收种猫信息卡与 Keeper's Note。"],
    breeding: {
      category: "king",
      reproductiveState: "active",
      statusLabel: "现役公猫",
      trait: "骨量稳定，性格亲人",
      source: "Visual QA 血线记录",
      sortOrder: 1,
    },
  }),
  cat({
    id: "visual-stud-queen",
    name: "月见",
    gender: "female",
    color: "蓝银虎斑",
    birthday: "2023-09-20",
    lifecycleStatus: "breeding",
    image: "stud-queen.png",
    personality: "温柔稳重，带崽细致。",
    story: ["月见覆盖现役母猫筛选和详情页信息结构。"],
    breeding: {
      category: "queen",
      reproductiveState: "active",
      statusLabel: "现役母猫",
      trait: "母性稳定，毛量优秀",
      source: "Visual QA 血线记录",
      sortOrder: 2,
    },
  }),
  cat({
    id: "visual-stud-candidate",
    name: "晨星",
    gender: "female",
    color: "玳瑁银",
    birthday: "2025-12-06",
    lifecycleStatus: "growing",
    image: "stud-candidate.png",
    personality: "观察中，结构潜力好。",
    story: ["晨星覆盖预备役种猫筛选，避免种猫页只剩空状态。"],
    breeding: {
      category: "candidate",
      reproductiveState: "observing",
      statusLabel: "预备役种猫",
      trait: "预备役观察中",
      source: "Visual QA 自留观察",
      sortOrder: 3,
    },
  }),
];

const posts: CommunityPostData[] = [
  post({
    id: "visual-post-daily",
    authorName: "月七",
    authorRole: "keeper",
    category: "cattery_daily",
    content: "Visual QA：今天给 A 窝拍了新的成长记录，三只小猫状态都很好。",
    image: "kitten-available.png",
    cats: ["visual-kitten-available", "visual-kitten-reserved"],
    litters: ["visual-litter-aurora"],
    pinned: true,
    likeCount: 18,
    commentCount: 2,
  }),
  post({
    id: "visual-post-parent",
    authorName: "云朵家长",
    authorRole: "parent",
    category: "parent_share",
    content: "Visual QA：到家第一晚会主动吃饭，也愿意和我们玩逗猫棒。",
    image: "kitten-reserved.png",
    cats: ["visual-kitten-reserved"],
    litters: ["visual-litter-aurora"],
    pinned: false,
    likeCount: 9,
    commentCount: 1,
  }),
  post({
    id: "visual-post-thought",
    authorName: "月七",
    authorRole: "keeper",
    category: "personal_thoughts",
    content: "Visual QA：做繁育最重要的是稳定记录，也要让每个家庭看到真实成长过程。",
    image: "stud-queen.png",
    cats: ["visual-stud-queen"],
    litters: ["visual-litter-moon"],
    pinned: false,
    likeCount: 12,
    commentCount: 0,
  }),
];

const myCats: MyCatData[] = [
  {
    id: "visual-my-cat-yunduo",
    name: "云朵",
    gender: "female",
    color: "蓝银虎斑加白",
    birthday: "2026-07-18",
    lifecycleStatus: "adopted",
    personality: "亲人、胆大，会主动贴贴。时光轴用于验收家长猫咪详情的动态卡片密度。",
    visibility: "visible",
    mediaAssets: [
      {
        id: "visual-my-cat-yunduo-cover",
        kind: "image",
        sourceUrl: `${imageBase}/kitten-available.png`,
        thumbnailUrl: `${imageBase}/kitten-available.png`,
        title: "云朵 Visual QA",
        altText: "云朵",
        usage: "cover",
        sortOrder: 0,
      },
    ],
    relationship: "owner",
    relationshipStartedAt: "2026-09-01T00:00:00.000Z",
    litter: litters[0],
    timelinePosts: posts.slice(0, 2),
    createdAt: now,
    updatedAt: now,
  },
];

function post(input: {
  authorName: string;
  authorRole: string;
  cats: string[];
  category: CommunityPostCategory;
  commentCount: number;
  content: string;
  id: string;
  image: string;
  likeCount: number;
  litters: string[];
  pinned: boolean;
}): CommunityPostData {
  return {
    id: input.id,
    authorName: input.authorName,
    authorRole: input.authorRole,
    category: input.category,
    content: input.content,
    visibility: "visible",
    pinned: input.pinned,
    cats: cats
      .filter((cat) => input.cats.includes(cat.id))
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        gender: cat.gender,
        color: cat.color,
        lifecycleStatus: cat.lifecycleStatus,
        visibility: cat.visibility,
      })),
    litters: litters.filter((litter) => input.litters.includes(litter.id)),
    mediaAssets: [
      {
        id: `${input.id}-image-1`,
        kind: "image",
        sourceUrl: `${imageBase}/${input.image}`,
        thumbnailUrl: `${imageBase}/${input.image}`,
        title: "Visual QA post image",
        altText: input.content,
        usage: "content",
        sortOrder: 0,
      },
    ],
    comments: Array.from({ length: input.commentCount }).map((_, index) => ({
      id: `${input.id}-comment-${index + 1}`,
      postId: input.id,
      authorName: "星月猫友",
      authorRole: "user",
      content: "Visual QA 评论，用于验收帖子详情评论区域。",
      visibility: "visible",
      canDelete: false,
      createdAt: "2026-09-15T08:00:00.000Z",
      updatedAt: "2026-09-15T08:00:00.000Z",
      deletedAt: null,
    })),
    commentCount: input.commentCount,
    likeCount: input.likeCount,
    likedByMe: input.id === "visual-post-parent",
    canEdit: false,
    canDelete: false,
    createdAt: "2026-09-15T07:00:00.000Z",
    updatedAt: "2026-09-15T07:00:00.000Z",
  };
}

function paginate<T>(items: T[]) {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
    },
  };
}
