export type HomepageGroupId = "about" | "beforeAdopt";

export type HomepageEntryId =
  | "about"
  | "environment"
  | "philosophy"
  | "breedingPlan"
  | "feeding"
  | "process"
  | "aftercare"
  | "questionnaire"
  | "contact";

export type HomepageArtKey = "catProfile" | "windingPath";

export type HomepageSlide = {
  id: string;
  label: string;
  imageId?: string;
};

export type HomepageEntry = {
  id: HomepageEntryId;
  fixedGroupId: HomepageGroupId;
  title: string;
  desc: string;
  to: string | null;
  statusLabel?: string;
};

export type HomepageGroup = {
  id: HomepageGroupId;
  en: string;
  cn: string;
  lead: string;
  artKey: HomepageArtKey;
  tint: string;
  entryOrder: HomepageEntryId[];
};

export type HomepageContent = {
  version: 1;
  hero: {
    title: string;
    subtitle: string;
    slides: HomepageSlide[];
  };
  intro: {
    eyebrowPrefix: string;
    fixedMeta: string;
    body: string;
  };
  groups: HomepageGroup[];
  entries: Record<HomepageEntryId, HomepageEntry>;
  catsPreview: {
    eyebrow: "Our Cats";
    title: "我们的猫";
    description: string;
    buttonText: "查看小猫与种猫";
    to: "/cats";
  };
};

export const HOMEPAGE_GROUP_IDS: HomepageGroupId[] = ["about", "beforeAdopt"];

export const HOMEPAGE_ENTRY_IDS: HomepageEntryId[] = [
  "about",
  "environment",
  "philosophy",
  "breedingPlan",
  "feeding",
  "process",
  "aftercare",
  "questionnaire",
  "contact",
];

export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  version: 1,
  hero: {
    title: "星月缅因猫舍",
    subtitle: "StarlitSky Maine Coon Cattery",
    slides: [
      { id: "hero-1", label: "示例图片（首页轮播照片 1，待替换）" },
      { id: "hero-2", label: "示例图片（首页轮播照片 2，待替换）" },
      { id: "hero-3", label: "示例图片（首页轮播照片 3，待替换）" },
    ],
  },
  intro: {
    eyebrowPrefix: "Est.",
    fixedMeta: "2019 · Xi'an · WCF / CFA 注册",
    body: "做一家有温度的缅因猫舍\n低频率繁育别墅散养专注小猫社会化\n记录小猫从出生到去新家的日常\n绝育找家，长期售后",
  },
  groups: [
    {
      id: "about",
      en: "About StarlitSky",
      cn: "关于星月",
      lead: "了解星月缅因猫舍的\n成立时间、主理人\n与繁育理念、生活照顾方式。",
      artKey: "catProfile",
      tint: "text-lilac/70",
      entryOrder: ["about", "environment", "philosophy", "breedingPlan", "feeding"],
    },
    {
      id: "beforeAdopt",
      en: "Before You Adopt",
      cn: "接猫前了解",
      lead: "在正式咨询和接猫前\n可以先了解流程、保障\n问卷和联系方式。",
      artKey: "windingPath",
      tint: "text-lilac/60",
      entryOrder: ["process", "aftercare", "questionnaire", "contact"],
    },
  ],
  entries: {
    about: {
      id: "about",
      fixedGroupId: "about",
      title: "猫舍介绍",
      desc: "2019 年成立于西安，注册于 WCF、CFA，由星下与月七全职经营。",
      to: "/about",
    },
    environment: {
      id: "environment",
      fixedGroupId: "about",
      title: "猫舍环境",
      desc: "600 余平别墅散养，科学分区、拒绝笼养，另有三个院子供奔跑。",
      to: "/environment",
    },
    philosophy: {
      id: "philosophy",
      fixedGroupId: "about",
      title: "繁育理念",
      desc: "繁育体质好、亲人自信的小猫，从出生记录到去新家的每一步。",
      to: "/philosophy",
    },
    breedingPlan: {
      id: "breedingPlan",
      fixedGroupId: "about",
      title: "繁育计划",
      desc: "查看 2026 下半年繁育组合、预计时间与预计花色。",
      to: "/breeding-plan",
    },
    feeding: {
      id: "feeding",
      fixedGroupId: "about",
      title: "喂养体系",
      desc: "白天湿粮与熟自制，夜间猫粮自助并补充冻干、营养品，从小不挑食。",
      to: "/feeding",
    },
    process: {
      id: "process",
      fixedGroupId: "beforeAdopt",
      title: "价格与接猫流程",
      desc: "阅读介绍、填写问卷、排队、选猫，到疫苗体检绝育后接猫。",
      to: "/process",
    },
    aftercare: {
      id: "aftercare",
      fixedGroupId: "beforeAdopt",
      title: "售后保障",
      desc: "种猫遗传病 all n/n，窝次透明，去新家前完成疫苗、体检与绝育。",
      to: "/aftercare",
    },
    questionnaire: {
      id: "questionnaire",
      fixedGroupId: "beforeAdopt",
      title: "选猫问卷",
      desc: "填写一份问卷，让我们更好地了解你的期待与生活方式。",
      to: "/questionnaire",
    },
    contact: {
      id: "contact",
      fixedGroupId: "beforeAdopt",
      title: "联系方式",
      desc: "微信、小红书、微博、抖音与小猫日常号，都可一键复制。",
      to: "/contact",
    },
  },
  catsPreview: {
    eyebrow: "Our Cats",
    title: "我们的猫",
    description: "在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康透明。",
    buttonText: "查看小猫与种猫",
    to: "/cats",
  },
};

export function cloneHomepageContent(content: HomepageContent = DEFAULT_HOMEPAGE_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as HomepageContent;
}

export function getHomepageEntryNo(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function normalizeHomepageContent(value: unknown): HomepageContent {
  if (!value || typeof value !== "object") return cloneHomepageContent();

  const input = value as Partial<HomepageContent>;
  const base = cloneHomepageContent();
  const mergedEntries = { ...base.entries, ...(input.entries ?? {}) };
  const { statusLabel: _breedingPlanStatusLabel, ...breedingPlanEntry } =
    mergedEntries.breedingPlan;
  const entries = {
    ...mergedEntries,
    breedingPlan: {
      ...breedingPlanEntry,
      to: "/breeding-plan",
    },
  };
  const groups = (input.groups ?? base.groups)
    .filter((group): group is HomepageGroup => HOMEPAGE_GROUP_IDS.includes(group.id))
    .map((group) => {
      const fallback = base.groups.find((item) => item.id === group.id)!;
      const allowed = HOMEPAGE_ENTRY_IDS.filter((id) => entries[id]?.fixedGroupId === group.id);
      const ordered = group.entryOrder.filter((id) => allowed.includes(id));
      return {
        ...fallback,
        ...group,
        entryOrder: [...ordered, ...allowed.filter((id) => !ordered.includes(id))],
      };
    });

  const missingGroups = base.groups.filter((group) => !groups.some((item) => item.id === group.id));

  return {
    version: 1,
    hero: {
      ...base.hero,
      ...(input.hero ?? {}),
      slides: input.hero?.slides?.length ? input.hero.slides : base.hero.slides,
    },
    intro: { ...base.intro, ...(input.intro ?? {}), fixedMeta: base.intro.fixedMeta },
    groups: [...groups, ...missingGroups],
    entries,
    catsPreview: {
      ...base.catsPreview,
      ...(input.catsPreview ?? {}),
      eyebrow: "Our Cats",
      title: "我们的猫",
      buttonText: "查看小猫与种猫",
      to: "/cats",
    },
  };
}
