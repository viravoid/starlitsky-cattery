import type { CatData, FixedPageMediaAssetData } from "@starlitsky/shared";
import { resolveCatFrame, type ImageFrameMode } from "./cat-presentation";
import { getFixedPageMediaUrl, mapFixedPageMedia } from "./fixed-page-media";

export type FixedPageViewKind =
  | "about"
  | "aftercare"
  | "breeding-plan"
  | "contact"
  | "environment"
  | "feeding"
  | "generic"
  | "philosophy"
  | "process";

export interface PageImage {
  altText: string;
  id: string;
  title: string;
  url: string;
}

export interface TextItem {
  id: string;
  text: string;
}

export interface FactItem {
  icon: string;
  iconClass: string;
  id: string;
  text: string;
}

export interface GenericSection {
  body: string;
  id: string;
  title: string;
}

export interface EnvironmentRoomView {
  description: string;
  id: string;
  images: PageImage[];
  imageSlots: PageImageSlot[];
  title: string;
}

export interface EnvironmentSectionView {
  id: string;
  meta: string;
  photoCount: number;
  roomCount: number;
  rooms: EnvironmentRoomView[];
  summary: string;
  title: string;
}

export interface PageImageSlot {
  id: string;
  image: PageImage | null;
  label: string;
}

export interface FeedingModuleView {
  body: string;
  id: string;
  images: PageImageSlot[];
  no: string;
  title: string;
}

export interface ProcessPriceCardView {
  id: string;
  label: string;
  note: string;
  tone: string;
  value: string;
}

export interface ProcessSimpleCardView {
  id: string;
  label: string;
  value: string;
}

export interface ProcessStepView {
  description: string;
  id: string;
  no: number;
  title: string;
}

export interface BreedingPlanStudView {
  color: string;
  id: string;
  imageClass: string;
  imageMode: ImageFrameMode;
  imageStyle: string;
  imageUrl: string;
  name: string;
}

export interface BreedingPlanPairingView {
  colors: TextItem[];
  colorNote: string;
  female: BreedingPlanStudView | null;
  femaleFallbackId: string;
  id: string;
  male: BreedingPlanStudView | null;
  maleFallbackId: string;
  timeLabel: string;
}

export interface BreedingPlanGroupView {
  description: string;
  eyebrow: string;
  id: string;
  pairings: BreedingPlanPairingView[];
  showTrail: boolean;
  title: string;
}

export interface FixedPageViewData {
  aboutBodyParagraphs: TextItem[];
  aboutFacts: FactItem[];
  aboutHeroHeight: number;
  aboutHeroSlides: PageImageSlot[];
  aboutOwnerBody: string;
  aboutOwnerTitle: string;
  accounts: ProcessSimpleCardView[];
  aftercareContractBadge: string;
  aftercareContractExtension: string;
  aftercareContractFileName: string;
  aftercareContractTitle: string;
  aftercareContractUrl: string;
  aftercareHealthItems: TextItem[];
  aftercarePromises: Array<TextItem & { icon: string }>;
  body: string;
  breedingGroups: BreedingPlanGroupView[];
  breedingIntroduction: string;
  breedingPeriod: string;
  colorDisclaimer: string;
  contactFooterNotice: string;
  contactIntroduction: string;
  coverImage: PageImage | null;
  environmentIntro: string;
  environmentSections: EnvironmentSectionView[];
  environmentTags: TextItem[];
  error: string;
  feedingIntro: string;
  feedingModules: FeedingModuleView[];
  footerNotice: string;
  galleryImages: PageImage[];
  genericFacts: string[];
  genericSections: GenericSection[];
  hasAftercareContractAsset: boolean;
  isLoading: boolean;
  philosophyParagraphs: TextItem[];
  previewUrls: string[];
  priceCards: ProcessPriceCardView[];
  pricingIntro: string;
  processBreedingCards: ProcessSimpleCardView[];
  processBreedingIntro: string;
  processContractNotice: string;
  processReturningBenefits: ProcessSimpleCardView[];
  processReturningIntro: string;
  processSteps: ProcessStepView[];
  scheduleDisclaimer: string;
  slug: string;
  title: string;
  viewKind: FixedPageViewKind;
  welcomeKitItems: TextItem[];
  welcomeKitNote: string;
}

const IMAGE_ASSETS = {
  cat: "../../assets/tabbar/cats-active.png",
  catProfile: "../../assets/illustrations/cat-profile.png",
  check: "../../assets/illustrations/check-icon.png",
  chevronRight: "../../assets/illustrations/chevron-right-icon.png",
  cottage: "../../assets/illustrations/cottage.png",
  curledCat: "../../assets/illustrations/curled-cat.png",
  dnaHelix: "../../assets/illustrations/dna-helix.png",
  gift: "../../assets/illustrations/gift-icon.png",
  heart: "../../assets/illustrations/heart-icon.png",
  heartLine: "../../assets/illustrations/heart-line-icon.png",
  heartPaw: "../../assets/illustrations/heart-paw.png",
  leaf: "../../assets/illustrations/leaf-icon.png",
  moon: "../../assets/illustrations/moon-icon.png",
  moonLine: "../../assets/illustrations/moon-line-icon.png",
  moonStars: "../../assets/illustrations/moon-stars.png",
  paw: "../../assets/illustrations/paw-like.png",
  pawLine: "../../assets/illustrations/paw-icon.png",
  paper: "../../assets/illustrations/paper-icon-white.png",
  priceTag: "../../assets/illustrations/price-tag-icon.png",
  rosette: "../../assets/illustrations/rosette.png",
  route: "../../assets/illustrations/route-icon.png",
  star: "../../assets/illustrations/star-icon.png",
  windingPath: "../../assets/illustrations/winding-path.png",
};

const EMPTY_VIEW: FixedPageViewData = {
  aboutBodyParagraphs: [],
  aboutFacts: [],
  aboutHeroHeight: 419,
  aboutHeroSlides: [],
  aboutOwnerBody: "两位主理人全职经营猫舍，持续陪伴小猫成长，也在不断学习和完善繁育与行为学知识。",
  aboutOwnerTitle: "主理人 · 星下 & 月七",
  accounts: [],
  aftercareContractBadge: "",
  aftercareContractExtension: "",
  aftercareContractFileName: "",
  aftercareContractTitle: "",
  aftercareContractUrl: "",
  aftercareHealthItems: [],
  aftercarePromises: [],
  body: "",
  breedingGroups: [],
  breedingIntroduction: "",
  breedingPeriod: "",
  colorDisclaimer: "",
  contactFooterNotice: "",
  contactIntroduction: "",
  coverImage: null,
  environmentIntro: "",
  environmentSections: [],
  environmentTags: [],
  error: "",
  feedingIntro: "",
  feedingModules: [],
  footerNotice: "",
  galleryImages: [],
  genericFacts: [],
  genericSections: [],
  hasAftercareContractAsset: false,
  isLoading: true,
  philosophyParagraphs: [],
  previewUrls: [],
  priceCards: [],
  pricingIntro: "",
  processBreedingCards: [],
  processBreedingIntro: "",
  processContractNotice: "",
  processReturningBenefits: [],
  processReturningIntro: "",
  processSteps: [],
  scheduleDisclaimer: "",
  slug: "about",
  title: "猫舍介绍",
  viewKind: "generic",
  welcomeKitItems: [],
  welcomeKitNote: "",
};

const FIXED_TAGS = ["共四层", "600+ ㎡ 室内", "两个庭院 + 下沉院", "科学规划"];
const ABOUT_FACT_ORDER = [
  ["founded", "moonStars"],
  ["location", "cottage"],
  ["registration", "rosette"],
  ["socialization", "heartPaw"],
  ["aftercare", "curledCat"],
  ["screening", "heartPaw"],
] as const;
const AFTERCARE_PROMISE_ICONS = ["paw", "heart", "cat", "check"];
const PRICE_TONES = ["tone-sky", "tone-creamblue", "tone-sunny"];
const DEFAULT_ENVIRONMENT_SECTIONS = [
  {
    id: "environment-zone-nursery",
    title: "母婴区",
    summary: "孕猫房和育婴房挨着我们的卧室，怀孕 30 天以上的母猫和 1-2 月龄小奶猫生活在这里。",
    meta: "2 个房间 · 约 52㎡",
    rooms: [
      { id: "environment-room-nursery-pregnancy", title: "孕猫房", description: "临产前的母猫会先在这里适应待产环境。", images: [] },
      { id: "environment-room-nursery-newborn", title: "育婴房", description: "小奶猫出生后会在这里和妈妈一起度过最需要安静陪伴的阶段。", images: [] },
    ],
  },
  {
    id: "environment-zone-kitten",
    title: "幼猫生活区",
    summary: "幼猫区分为三个小房间和一个大活动房，按窝次和月龄安排生活与活动节奏。",
    meta: "4 个房间 · 约 66㎡",
    rooms: [
      { id: "environment-room-kitten-1", title: "房间一", description: "供一窝小猫进行基础社会化训练和日常休息。", images: [] },
      { id: "environment-room-kitten-2", title: "房间二", description: "为不同窝次的小猫提供独立但稳定的生活空间。", images: [] },
      { id: "environment-room-kitten-3", title: "房间三", description: "用于不同窝次的小猫错峰活动。", images: [] },
      { id: "environment-room-kitten-common", title: "大活动房", description: "4 月龄以上并打齐疫苗的宝宝会在这里自由活动。", images: [] },
    ],
  },
  {
    id: "environment-zone-queen",
    title: "种母生活区",
    summary: "由五个房间组成，按母猫的猫际关系分配合适房间，部分母猫和我们生活在客厅卧室。",
    meta: "5 个房间 · 约 102㎡",
    rooms: [
      { id: "environment-room-queen-1", title: "房间一", description: "", images: [] },
      { id: "environment-room-queen-2", title: "房间二", description: "", images: [] },
      { id: "environment-room-queen-3", title: "房间三", description: "", images: [] },
      { id: "environment-room-queen-4", title: "房间四", description: "", images: [] },
      { id: "environment-room-queen-common", title: "客厅 / 卧室共居区", description: "", images: [] },
    ],
  },
  {
    id: "environment-zone-king",
    title: "种公生活区",
    summary: "三间种公房、三个室外隔间和一个院子，让公猫拥有单独、安全、通风的活动节奏。",
    meta: "3 个种公房 + 3 个室外隔间 · 室内约 65㎡ / 室外约 40㎡",
    rooms: [
      { id: "environment-room-king-1", title: "种公房一", description: "", images: [] },
      { id: "environment-room-king-2", title: "种公房二", description: "", images: [] },
      { id: "environment-room-king-3", title: "种公房三", description: "", images: [] },
      { id: "environment-room-king-outdoor", title: "室外隔间", description: "", images: [] },
      { id: "environment-room-king-yard", title: "院子", description: "", images: [] },
    ],
  },
  {
    id: "environment-zone-common",
    title: "公共活动区",
    summary: "公区作为人类生活区、宠物猫和退役种猫的生活空间，也会让打齐疫苗的小猫散养活动。",
    meta: "室内 220㎡ · 花园 70㎡",
    rooms: [
      { id: "environment-room-common-living", title: "客厅活动区", description: "宠物猫、退役种猫和部分粘人母猫会在这里和我们一起生活。", images: [] },
      { id: "environment-room-common-garden", title: "庭院 / 下沉院", description: "两个庭院和下沉式院子会在合适时段开放。", images: [] },
    ],
  },
  {
    id: "environment-zone-care",
    title: "隔离房 · 医疗间 · 洗护间",
    summary: "隔离房、医疗间和洗护间承担新猫隔离、基础检查、短期观察和日常护理。",
    meta: "3 个功能空间",
    rooms: [
      { id: "environment-room-care-isolation", title: "隔离房", description: "新到家的小猫会先独立观察。", images: [] },
      { id: "environment-room-care-medical", title: "医疗间", description: "用于基础体检和生病小猫的短期隔离观察。", images: [] },
      { id: "environment-room-care-grooming", title: "洗护间", description: "配有赛洗设备，方便洗护、吹毛和日常整理。", images: [] },
    ],
  },
];
const DEFAULT_FEEDING_MODULES = [
  {
    id: "feeding-module-cooked",
    title: "熟自制",
    body: "考虑到小猫饮食多样、营养均衡，我们会采购不同种类的白肉、红肉及内脏，按照正确配比添加营养补剂。\n红肉（不同部位牛肉鹿肉，偶尔鸵鸟）\n内脏（牛、兔、鸡内脏）\n白肉（鸡胸鸡腿，鸭胸）",
    images: [],
  },
  {
    id: "feeding-module-kibble",
    title: "猫粮 · 罐头 · 冻干",
    body: "猫粮\n目前猫粮以进口粮为主，不定期更换。\n\n罐头\n德罐为主，奶猫开食使用奶糕。\n\n冻干\n按阶段补充不同品牌冻干。",
    images: [],
  },
  {
    id: "feeding-module-supplements",
    title: "保健品",
    body: "布拉迪益生菌、乳铁蛋白、鱼油、多种维生素片等，会按阶段和个体情况补充。",
    images: [],
  },
];
const DEFAULT_PRICE_CARDS = [
  { id: "process-price-pet", label: "宠物级", value: "10000 - 20000 元", note: "符合品标，有少量扣分项或性格有些许瑕疵，社会化达标，身体健康。" },
  { id: "process-price-show", label: "赛级", value: "20000 - 30000 元", note: "符合品标且无明显扣分项，性格同样非常好，社会化达标，身体健康。" },
  { id: "process-price-retired", label: "退役种猫", value: "0 - 10000 元", note: "老家长优先，退役种猫找家会严格审核。" },
];
const DEFAULT_BREEDING_CARDS = [
  { id: "process-breeding-queen", label: "繁育权 · 母猫", value: "30000 - 50000 元" },
  { id: "process-breeding-king", label: "繁育权 · 公猫", value: "40000 - 70000 元" },
];
const DEFAULT_RETURNING_BENEFITS = [
  { id: "process-returning-second", label: "二胎", value: "9 折" },
  { id: "process-returning-third", label: "三胎", value: "8 折" },
  { id: "process-returning-fourth", label: "四胎", value: "7 折" },
  { id: "process-returning-retired", label: "退役猫", value: "免费\n领养" },
];
const DEFAULT_PROCESS_STEPS = [
  { id: "process-step-questionnaire", title: "了解猫舍，填写问卷", description: "先阅读置顶内容，有意接猫可填写选猫问卷，互相了解。" },
  { id: "process-step-contract", title: "排队选猫，签订合同", description: "确认适合后进入排队、看猫、选猫与合同流程。" },
  { id: "process-step-health", title: "疫苗、体检、绝育与康复", description: "小猫会在疫苗、体检和绝育康复完成后去新家。" },
  { id: "process-step-welcome", title: "接猫指导与新家礼包", description: "到家前提供详细指导，并寄出新家礼包。" },
];
const DEFAULT_WELCOME_KIT = ["过渡粮", "罐头", "随机零食", "药品分装", "湿巾", "大号航空箱", "小猫喜欢的玩具", "体检报告"];
const DEFAULT_AFTERCARE_PROMISES = [
  "种猫全部做遗传病检查，结果 all n/n",
  "科学繁育，根据母猫状态安排窝次间隔，窝次清晰透明",
  "所有小猫均为我们猫舍自己繁育、从小照顾并社会化训练、找家",
  "拒绝高频繁育、借配、合作出售、近亲交配、出售病猫等行为",
];
const DEFAULT_AFTERCARE_HEALTH = [
  "疫苗 3 针，抗体浓度检测",
  "血常规，粪检，基础检查",
  "小猫成年心超报销一次",
  "公猫 / 母猫微创绝育",
  "术后消炎针，营养补充",
  "3-5 月龄外驱、内驱一次",
];
const DEFAULT_BREEDING_GROUPS = [
  {
    id: "breeding-plan-group-visual",
    eyebrow: "Next",
    title: "下一阶段繁育组合",
    description: "实际时间、数量和花色存在自然不确定性。",
    pairings: [
      {
        id: "breeding-plan-pairing-visual",
        maleStudId: "visual-stud-king",
        femaleStudId: "visual-stud-queen",
        timeLabel: "计划中",
        possibleColors: ["银虎斑", "蓝银虎斑", "银虎斑加白"],
        colorPossibilityNote: "最终以实际出生和基因表达为准。",
      },
    ],
  },
];
const DEFAULT_CONTACT_ACCOUNTS = [
  { id: "contact-account-wechat", label: "微信", value: "StarlitSkyCattery" },
  { id: "contact-account-redbook", label: "小红书", value: "星月缅因猫舍" },
];

export function emptyFixedPageView(slug = "about"): FixedPageViewData {
  return {
    ...EMPTY_VIEW,
    ...fallbackForSlug(slug),
    slug,
    viewKind: viewKindForSlug(slug),
  };
}

export function normalizeFixedPageView(
  slug: string,
  title: string,
  value: unknown,
  mediaAssets: FixedPageMediaAssetData[] = [],
  cats: CatData[] = [],
): FixedPageViewData {
  const base = emptyFixedPageView(slug);
  const input = isRecord(value) ? value : {};
  const pageImages = normalizePageImages(slug, mediaAssets);
  const common = {
    ...base,
    ...pageImages,
    body: textOr(input.body, base.body),
    footerNotice: textOr(input.footerNotice, base.footerNotice),
    genericFacts: normalizeFactStrings(input.facts, base.genericFacts),
    genericSections: normalizeGenericSections(input.sections, base.genericSections),
    isLoading: false,
    slug,
    title: decodePlainTextEntities(title || base.title),
    viewKind: viewKindForSlug(slug),
  };

  switch (common.viewKind) {
    case "about":
      return normalizeAbout(common, input, mediaAssets);
    case "philosophy":
      return normalizePhilosophy(common, input);
    case "environment":
      return normalizeEnvironment(common, input, mediaAssets);
    case "feeding":
      return normalizeFeeding(common, input, mediaAssets);
    case "process":
      return normalizeProcess(common, input);
    case "aftercare":
      return normalizeAftercare(common, input, mediaAssets);
    case "contact":
      return normalizeContact(common, input);
    case "breeding-plan":
      return normalizeBreedingPlan(common, input, cats);
    default:
      return common;
  }
}

export function findEnvironmentSection(
  view: FixedPageViewData,
  sectionId: string,
): EnvironmentSectionView | null {
  return view.environmentSections.find((section) => section.id === sectionId) ?? null;
}

function normalizeAbout(
  view: FixedPageViewData,
  input: Record<string, unknown>,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const facts = isRecord(input.facts) ? input.facts : {};
  const hero = isRecord(input.hero) ? input.hero : {};
  const aspect = isRecord(hero.aspectRatio) ? hero.aspectRatio : { width: 16, height: 10 };
  const slides = Array.isArray(hero.slides) && hero.slides.length ? hero.slides : [{ id: "about-hero-1", label: "猫舍介绍主图" }];

  return {
    ...view,
    aboutOwnerBody: textOr(input.ownerBody, view.aboutOwnerBody),
    aboutOwnerTitle: textOr(input.ownerTitle, view.aboutOwnerTitle),
    aboutBodyParagraphs: splitParagraphs(view.body).map(toTextItem("about-body")),
    aboutFacts: ABOUT_FACT_ORDER.map(([key, icon]) => ({
      icon: imageAsset(icon),
      iconClass: `about-fact-icon-${key}`,
      id: `about-fact-${key}`,
      text: textOr(facts[key], fallbackAboutFact(key)),
    })).filter((item) => item.text),
    aboutHeroHeight: ratioHeight(aspect, 670, 419),
    aboutHeroSlides: slides.map((slide, index) => {
      const item = isRecord(slide) ? slide : {};
      const label = textOr(item.label, `猫舍介绍主图 ${index + 1}`);
      return {
        id: stringOr(item.id, `about-hero-${index + 1}`),
        image: resolveImage(stringOr(item.imageId, ""), mediaAssets),
        label,
      };
    }),
  };
}

function normalizePhilosophy(view: FixedPageViewData, input: Record<string, unknown>) {
  const paragraphSource = [
    textOr(input.openingBelief, view.body),
    joinParagraphs([
      textOr(input.growthEffortParagraph, ""),
      textOr(input.growthCommunityParagraph, ""),
      textOr(input.growthFuturePlanParagraph, ""),
    ]),
    joinParagraphs([
      milestoneSentence(input.milestones),
      textOr(input.stageNewHomeParagraph, ""),
      textOr(input.stageClearGoalParagraph, ""),
    ]),
    joinParagraphs([
      textOr(input.styleBloodlineParagraph, ""),
      textOr(input.styleBeyondLabelsParagraph, ""),
      `${textOr(input.highlightLineOne, "")}${textOr(input.highlightLineTwo, "")}`,
      textOr(input.directionGlobalBreedersParagraph, ""),
      textOr(input.directionGoalParagraph, ""),
    ]),
    joinParagraphs([
      textOr(input.closingLifeParagraph, ""),
      textOr(input.closingCareerParagraph, ""),
      textOr(input.closingParentParagraph, ""),
      textOr(input.closingAftercareParagraph, ""),
    ]),
  ].filter((item) => item.trim());

  return {
    ...view,
    philosophyParagraphs: (paragraphSource.length ? paragraphSource : splitParagraphs(view.body)).map(
      toTextItem("philosophy"),
    ),
  };
}

function normalizeEnvironment(
  view: FixedPageViewData,
  input: Record<string, unknown>,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const sections = Array.isArray(input.sections) && input.sections.length
    ? input.sections
    : view.genericSections.length
      ? view.genericSections
      : DEFAULT_ENVIRONMENT_SECTIONS;
  const environmentSections = sections
    .map((section, index) => normalizeEnvironmentSection(section, index, mediaAssets))
    .filter((section) => section?.id !== "environment-zone-common" || section.photoCount > 0)
    .filter(Boolean) as EnvironmentSectionView[];

  return {
    ...view,
    environmentIntro: textOr(input.intro, view.body),
    environmentSections,
    environmentTags: FIXED_TAGS.map(toTextItem("environment-tag")),
  };
}

function normalizeFeeding(
  view: FixedPageViewData,
  input: Record<string, unknown>,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const modules = Array.isArray(input.modules) && input.modules.length
    ? input.modules
    : view.genericSections.length
      ? view.genericSections.map((section) => ({
          body: section.body,
          id: section.id,
          images: [],
          title: section.title,
        }))
      : DEFAULT_FEEDING_MODULES;

  return {
    ...view,
    feedingIntro: textOr(input.intro, view.body),
    feedingModules: modules
      .map((module, index) => normalizeFeedingModule(module, index, mediaAssets))
      .filter((module) => module.title || module.body),
  };
}

function normalizeProcess(view: FixedPageViewData, input: Record<string, unknown>) {
  const priceCards = normalizePriceCards(input.priceCards, DEFAULT_PRICE_CARDS);
  const breedingCards = normalizeSimpleCards(
    input.breedingCards,
    "process-breeding",
    DEFAULT_BREEDING_CARDS,
  );
  const returningBenefits = normalizeSimpleCards(
    input.returningBenefits,
    "process-returning",
    DEFAULT_RETURNING_BENEFITS,
  );
  const steps = normalizeSteps(input.steps, DEFAULT_PROCESS_STEPS);
  const welcomeKitItems = normalizeTextItems(
    input.welcomeKitItems,
    "process-kit",
    DEFAULT_WELCOME_KIT.map((text, index) => ({ id: `process-kit-${index + 1}`, text })),
  );

  return {
    ...view,
    priceCards,
    pricingIntro: textOr(input.pricingIntro, view.body),
    processBreedingCards: breedingCards,
    processBreedingIntro: textOr(input.breedingIntro, "繁育权仅面向互相了解、熟悉科学饲养和科学繁育的猫舍。"),
    processContractNotice: textOr(input.contractNotice, view.footerNotice),
    processReturningBenefits: returningBenefits,
    processReturningIntro: textOr(input.returningFamiliesIntro, "感谢一路同行的信任与陪伴，星月永远记得每一位老家长。"),
    processSteps: steps,
    welcomeKitItems,
    welcomeKitNote: textOr(input.welcomeKitNote, "内容可能偶尔调整，价值差别不大。"),
  };
}

function normalizeAftercare(
  view: FixedPageViewData,
  input: Record<string, unknown>,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const contractFile = isRecord(input.contractFile) ? input.contractFile : {};
  const contractMedia = resolveMediaAsset(stringOr(contractFile.assetId, ""), mediaAssets);
  const contractUrl = contractMedia ? getFixedPageMediaUrl(contractMedia) : "";
  const hasAsset = Boolean(contractUrl);
  const mimeType = stringOr(contractMedia?.mimeType ?? contractFile.mimeType, "");
  const fileName = textOr(
    contractFile.fileName ?? contractMedia?.title,
    "后台上传后，这里会显示可查看 / 下载的合同文件。",
  );

  return {
    ...view,
    aftercareContractBadge: mimeType.includes("pdf")
      ? "PDF"
      : hasAsset
        ? "文件"
        : "待上传",
    aftercareContractExtension: contractExtension(fileName, mimeType),
    aftercareContractFileName: fileName,
    aftercareContractTitle: textOr(contractFile.title, "购猫合同"),
    aftercareContractUrl: contractUrl,
    aftercareHealthItems: normalizeTextItems(
      input.healthItems,
      "aftercare-health",
      DEFAULT_AFTERCARE_HEALTH.map((text, index) => ({ id: `aftercare-health-${index + 1}`, text })),
    ),
    aftercarePromises: normalizeTextItems(
      input.promises,
      "aftercare-promise",
      DEFAULT_AFTERCARE_PROMISES.map((text, index) => ({ id: `aftercare-promise-${index + 1}`, text })),
    ).map((item, index) => ({
      ...item,
      icon: imageAsset(AFTERCARE_PROMISE_ICONS[index % AFTERCARE_PROMISE_ICONS.length]),
    })),
    hasAftercareContractAsset: hasAsset,
    processContractNotice: textOr(input.contractNotice, view.footerNotice),
  };
}

function normalizeContact(view: FixedPageViewData, input: Record<string, unknown>) {
  return {
    ...view,
    accounts: normalizeSimpleCards(input.accounts, "contact-account", DEFAULT_CONTACT_ACCOUNTS).filter(
      (item) => item.value,
    ),
    contactFooterNotice: textOr(input.footerNotice, view.footerNotice),
    contactIntroduction: textOr(input.introduction, ""),
  };
}

function normalizeBreedingPlan(
  view: FixedPageViewData,
  input: Record<string, unknown>,
  cats: CatData[],
) {
  const groups = Array.isArray(input.groups) && input.groups.length ? input.groups : DEFAULT_BREEDING_GROUPS;
  const studMap = new Map(
    cats
      .filter((cat) => cat.breedingProfile)
      .map((cat) => {
        const frame = resolveCatFrame(cat, "breedingPlanCard");
        return [
          normalizePublicCatId(cat.id),
          {
            color: textOr(cat.color, "待补充"),
            id: cat.id,
            imageClass:
              frame?.mode === "scaleToFill" ? "stud-image manual-crop-image" : "stud-image",
            imageMode: frame?.mode ?? "aspectFill",
            imageStyle: frame?.style ?? "",
            imageUrl: frame?.url || firstCatImageUrl(cat),
            name: decodePlainTextEntities(cat.name),
          },
        ];
      }),
  );

  return {
    ...view,
    breedingGroups: groups
      .map((group, groupIndex) => normalizeBreedingGroup(group, groupIndex, studMap))
      .filter((group) => group.pairings.length > 0),
    breedingIntroduction: textOr(input.introduction, view.body),
    breedingPeriod: textOr(input.period, "2026-2027 计划"),
    colorDisclaimer: textOr(isRecord(input.disclaimer) ? input.disclaimer.color : "", "花色仅为基于父母基因和历史经验的预估，不能作为最终承诺。"),
    scheduleDisclaimer: textOr(isRecord(input.disclaimer) ? input.disclaimer.schedule : "", "配种、怀孕、出生和开放排队时间会根据猫咪状态调整。"),
  };
}

function normalizeEnvironmentSection(
  raw: unknown,
  index: number,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const section = isRecord(raw) ? raw : {};
  const title = textOr(section.title ?? section.name, `环境分区 ${index + 1}`);
  const id = stringOr(section.id, `environment-section-${index + 1}`);
  const legacyRoom = {
    description: textOr(section.body ?? section.description, ""),
    id: `${id}-room-default`,
    images: Array.isArray(section.images) ? section.images : [],
    title: title.replace(/[:：].*$/, "") || "环境展示",
  };
  const rooms = (Array.isArray(section.rooms) && section.rooms.length ? section.rooms : [legacyRoom])
    .map((room, roomIndex) => normalizeEnvironmentRoom(room, id, roomIndex, mediaAssets))
    .filter(Boolean) as EnvironmentRoomView[];
  const photoCount = rooms.reduce((total, room) => total + room.imageSlots.length, 0);

  return {
    id,
    meta: textOr(section.meta ?? section.area, ""),
    photoCount,
    roomCount: rooms.length,
    rooms,
    summary: textOr(section.summary ?? section.body ?? section.description, ""),
    title,
  };
}

function normalizeEnvironmentRoom(
  raw: unknown,
  sectionId: string,
  index: number,
  mediaAssets: FixedPageMediaAssetData[],
) {
  const room = isRecord(raw) ? raw : {};
  const roomTitle = textOr(room.title, `房间 ${index + 1}`);
  const roomId = stringOr(room.id, `${sectionId}-room-${index + 1}`);
  const rawImages = Array.isArray(room.images) ? room.images : [];
  const imageSlots = rawImages.map((image, imageIndex) => {
    const item = isRecord(image) ? image : {};
    const label = `${roomTitle} · 第 ${imageIndex + 1} 张`;
    return {
      id: stringOr(item.id, `${roomId}-image-${imageIndex + 1}`),
      image: resolveImage(stringOr(item.imageId, ""), mediaAssets),
      label,
    };
  });

  return {
    description: textOr(room.description, ""),
    id: roomId,
    images: imageSlots.map((item) => item.image).filter(isPageImage),
    imageSlots,
    title: roomTitle,
  };
}

function normalizeFeedingModule(
  raw: unknown,
  index: number,
  mediaAssets: FixedPageMediaAssetData[],
): FeedingModuleView {
  const module = isRecord(raw) ? raw : {};
  const moduleTitle = textOr(module.title, `喂养模块 ${index + 1}`);
  const moduleId = stringOr(module.id, `feeding-module-${index + 1}`);
  const rawImages = Array.isArray(module.images) ? module.images : [];

  return {
    body: textOr(module.body ?? module.description, ""),
    id: moduleId,
    images: rawImages.map((image, imageIndex) => {
      const item = isRecord(image) ? image : {};
      return {
        id: stringOr(item.id, `${moduleId}-image-${imageIndex + 1}`),
        image: resolveImage(stringOr(item.imageId, ""), mediaAssets),
        label: `${moduleTitle}图片 ${imageIndex + 1}`,
      };
    }),
    no: String(index + 1).padStart(2, "0"),
    title: moduleTitle,
  };
}

function normalizeBreedingGroup(
  raw: unknown,
  index: number,
  studMap: Map<string, BreedingPlanStudView>,
): BreedingPlanGroupView {
  const group = isRecord(raw) ? raw : {};
  const pairings = Array.isArray(group.pairings) ? group.pairings : [];

  return {
    description: textOr(group.description, ""),
    eyebrow: textOr(group.eyebrow, ""),
    id: stringOr(group.id, `breeding-plan-group-${index + 1}`),
    pairings: pairings.map((pairing, pairingIndex) =>
      normalizeBreedingPairing(pairing, pairingIndex, studMap),
    ),
    showTrail: index > 0,
    title: textOr(group.title, ""),
  };
}

function normalizeBreedingPairing(
  raw: unknown,
  index: number,
  studMap: Map<string, BreedingPlanStudView>,
): BreedingPlanPairingView {
  const pairing = isRecord(raw) ? raw : {};
  const maleId = normalizePublicCatId(stringOr(pairing.maleStudId, ""));
  const femaleId = normalizePublicCatId(stringOr(pairing.femaleStudId, ""));
  const colors = Array.isArray(pairing.possibleColors) ? pairing.possibleColors : [];

  return {
    colorNote: textOr(pairing.colorPossibilityNote, ""),
    colors: colors.map((color, colorIndex) => ({
      id: `color-${index}-${colorIndex}`,
      text: decodePlainTextEntities(String(color)),
    })).filter((item) => item.text.trim()),
    female: studMap.get(femaleId) ?? null,
    femaleFallbackId: femaleId,
    id: stringOr(pairing.id, `breeding-plan-pairing-${index + 1}`),
    male: studMap.get(maleId) ?? null,
    maleFallbackId: maleId,
    timeLabel: textOr(pairing.timeLabel, ""),
  };
}

function normalizePageImages(slug: string, mediaAssets: FixedPageMediaAssetData[]) {
  const mapped = mapFixedPageMedia(slug, mediaAssets);
  const coverImage = slug === "environment" ? null : toPageImage(mapped.coverMedia);
  const galleryImages = mapped.galleryMedia.map(toPageImage).filter(isPageImage);
  const previewUrls = mapped.previewMedia.map(getFixedPageMediaUrl).filter(Boolean);

  return { coverImage, galleryImages, previewUrls };
}

function resolveImage(imageId: string, mediaAssets: FixedPageMediaAssetData[]) {
  if (!imageId) return null;
  const media = resolveMediaAsset(imageId, mediaAssets);
  return toPageImage(media ?? null);
}

function resolveMediaAsset(mediaId: string, mediaAssets: FixedPageMediaAssetData[]) {
  if (!mediaId) return null;
  return mediaAssets.find((item) => item.id === mediaId) ?? null;
}

function toPageImage(media: FixedPageMediaAssetData | null): PageImage | null {
  if (!media) return null;
  const url = getFixedPageMediaUrl(media);
  if (!url) return null;
  return {
    altText: decodePlainTextEntities(media.altText || media.title || ""),
    id: `${media.id}:${media.usage}:${media.sortOrder}`,
    title: decodePlainTextEntities(media.title || ""),
    url,
  };
}

function normalizeGenericSections(value: unknown, fallback: GenericSection[]) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((item, index) => {
    const input = isRecord(item) ? item : {};
    return {
      body: textOr(input.body ?? input.description ?? input.content, ""),
      id: stringOr(input.id, `section-${index + 1}`),
      title: textOr(input.title, ""),
    };
  }).filter((item) => item.title || item.body);
}

function normalizeFactStrings(value: unknown, fallback: string[]) {
  if (!isRecord(value)) return fallback;
  return Object.values(value)
    .map((item) => (typeof item === "string" ? decodePlainTextEntities(item).trim() : ""))
    .filter(Boolean);
}

function normalizeTextItems(value: unknown, prefix: string, fallback: TextItem[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item, index) => {
      const input = isRecord(item) ? item : {};
      return {
        id: stringOr(input.id, `${prefix}-${index + 1}`),
        text: textOr(input.text, ""),
      };
    })
    .filter((item) => item.text.trim());
}

function normalizePriceCards(value: unknown, fallback: unknown[] = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item, index) => {
      const input = isRecord(item) ? item : {};
      return {
        id: stringOr(input.id, `process-price-${index + 1}`),
        label: textOr(input.label, ""),
        note: textOr(input.note, ""),
        tone: PRICE_TONES[index % PRICE_TONES.length],
        value: textOr(input.value, ""),
      };
    })
    .filter((item) => item.label || item.value || item.note);
}

function normalizeSimpleCards(value: unknown, prefix: string, fallback: unknown[] = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item, index) => {
      const input = isRecord(item) ? item : {};
      return {
        id: stringOr(input.id, `${prefix}-${index + 1}`),
        label: textOr(input.label, ""),
        value: textOr(input.value, ""),
      };
    })
    .filter((item) => item.label || item.value);
}

function normalizeSteps(value: unknown, fallback: unknown[] = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item, index) => {
      const input = isRecord(item) ? item : {};
      return {
        description: textOr(input.description, ""),
        id: stringOr(input.id, `process-step-${index + 1}`),
        no: index + 1,
        title: textOr(input.title, ""),
      };
    })
    .filter((item) => item.title || item.description);
}

function fallbackForSlug(slug: string) {
  const title = titleForSlug(slug);
  switch (slug) {
    case "about":
      return {
        body: "欢迎了解我们的猫舍。星月缅因猫舍成立于 2019 年，位于西安，注册于 WCF、CFA。\n\n我们由主理人星下和月七全职经营，重视小猫健康、社会化训练、喂养和生活环境。",
        title,
      };
    case "philosophy":
      return {
        body: "我们希望繁育体质好、亲人、自信、能真正进入家庭生活的小猫。\n\n繁育不是追求数量，而是长期观察、谨慎搭配、尊重动物福利，并持续记录每一只小猫的成长。",
        title,
      };
    case "environment":
      return {
        body: "猫舍采用别墅散养与科学分区，日常清洁消毒，尽量让猫咪在稳定、舒展、有互动的环境中生活。",
        genericFacts: ["600 余平生活空间", "科学分区", "拒绝笼养", "日常清洁消毒"],
        title,
      };
    case "feeding":
      return {
        body: "喂养体系以湿粮、熟自制、猫粮自助和营养补充结合，让小猫从小适应多样食物，减少挑食。",
        title,
      };
    case "process":
      return {
        body: "建议先阅读猫舍介绍与繁育理念，再填写问卷或联系主理人沟通。确认适合后进入排队、看猫、选猫、体检、绝育和接猫流程。",
        title,
      };
    case "breeding-plan":
      return {
        body: "繁育计划用于查看预计组合、时间范围与可能花色。实际出生时间、小猫数量和花色存在自然不确定性，请以后续公开更新为准。",
        title,
      };
    case "aftercare":
      return {
        body: "我们重视长期售后。小猫去新家前会完成基础健康检查、疫苗安排和绝育要求，也会持续陪伴家长解决适应期问题。",
        title,
      };
    case "contact":
      return {
        contactIntroduction: "点击即可复制账号，欢迎来聊聊猫、看看小猫日常。",
        footerNotice: "咨询前建议先读完接猫流程，方便我们更好地沟通。",
        title,
      };
    default:
      return { title };
  }
}

function titleForSlug(slug: string) {
  const titles: Record<string, string> = {
    about: "猫舍介绍",
    aftercare: "售后保障",
    "breeding-plan": "繁育计划",
    contact: "联系方式",
    environment: "猫舍环境",
    feeding: "喂养体系",
    philosophy: "繁育理念",
    process: "价格与接猫流程",
  };
  return titles[slug] ?? "内容";
}

function viewKindForSlug(slug: string): FixedPageViewKind {
  if (
    slug === "about" ||
    slug === "aftercare" ||
    slug === "breeding-plan" ||
    slug === "contact" ||
    slug === "environment" ||
    slug === "feeding" ||
    slug === "philosophy" ||
    slug === "process"
  ) {
    return slug;
  }
  return "generic";
}

function fallbackAboutFact(key: string) {
  const values: Record<string, string> = {
    aftercare: "长期售后",
    founded: "2019 年成立",
    location: "西安",
    registration: "WCF / CFA 注册",
    screening: "种猫遗传病筛查 all n/n",
    socialization: "小猫从小社会化",
  };
  return values[key] ?? "";
}

function imageAsset(key: string) {
  return IMAGE_ASSETS[key as keyof typeof IMAGE_ASSETS] ?? IMAGE_ASSETS.catProfile;
}

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinParagraphs(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("");
}

function milestoneSentence(value: unknown) {
  if (!isRecord(value)) return "";
  const founder = isRecord(value.founder) ? textOr(value.founder.description, "") : "";
  const yueqi = isRecord(value.yueqi) ? textOr(value.yueqi.description, "") : "";
  if (!founder && !yueqi) return "";
  return `今年是${founder}${founder && yueqi ? "，" : ""}${yueqi}。`;
}

function ratioHeight(value: Record<string, unknown>, width: number, fallback: number) {
  const ratioWidth = Number(value.width);
  const ratioHeightValue = Number(value.height);
  if (!Number.isFinite(ratioWidth) || !Number.isFinite(ratioHeightValue) || ratioWidth <= 0) {
    return fallback;
  }
  return Math.round((width * ratioHeightValue) / ratioWidth);
}

function firstCatImageUrl(cat: CatData) {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  return image?.thumbnailUrl || image?.sourceUrl || "";
}

function normalizePublicCatId(value: string) {
  return value.replace(/^public-content-cat-/, "");
}

function contractExtension(fileName: string, mimeType: string) {
  const fromName = fileName.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("wordprocessingml")) return "docx";
  if (mimeType.includes("msword")) return "doc";
  return "";
}

function toTextItem(prefix: string) {
  return (text: string, index: number) => ({
    id: `${prefix}-${index + 1}`,
    text,
  });
}

function isPageImage(value: PageImage | null): value is PageImage {
  return Boolean(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function textOr(value: unknown, fallback: string) {
  return decodePlainTextEntities(stringOr(value, fallback));
}

function decodePlainTextEntities(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos|#39);/g, (match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
      case "#39":
        return "'";
      default:
        return match;
    }
  });
}
