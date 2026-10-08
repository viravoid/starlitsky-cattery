#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { chmodSync, mkdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { prisma } from "../db/prisma.mjs";
import { completeMediaUpload, requestImageUpload } from "../services/media-upload-service.mjs";

const HERO_SHA256 = "89cc5219f73df592c9bfc191b64637c5c0f21e9de523368518ace944b2517d23";
const HERO_BYTES = 376672;
const HERO_FILE_NAME = "P01-home-hero.jpg";
const HOME_PAGE_ID = "fixed-page-home";
const YIYI_CAT_ID = "public-content-cat-luoyiyi";
const YIYI_PUBLIC_CONTENT_ID = "luoyiyi";
const YIYI_STORY =
  "来自琥珀x洛阳的组合，这窝的宝宝是我们很满意的一窝改良型搭配，普遍继承了麻麻的大体格肌肉轮廓清晰，还有爸爸更精致的表情和厚实的毛发，但是整体还是更接近欧血。依依的结构比较夸张，她有着非常饱满的嘴套，强壮的下巴，转折清晰的侧脸，和满分的大耳朵，身长体格也很优秀，性格则是非常喜欢和人互动，比较聪明有自己想法那种，希望后续搭配我们的美血公猫能繁育出更均衡，继承双方优点的甜酷小猫";

const options = parseArgs(process.argv.slice(2));

try {
  const hero = readHeroFile(options.hero);
  const audit = await buildAudit(hero);

  if (options.json) {
    console.log(JSON.stringify(audit, null, 2));
  } else {
    printAudit(audit);
  }

  if (!options.apply) {
    process.exitCode = audit.blockers.length ? 1 : 0;
  } else {
    if (audit.blockers.length) {
      throw new Error(`Refusing apply with blockers: ${audit.blockers.join("; ")}`);
    }
    const result = await applyUpdate(hero);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Applied demo recovery update.`);
      console.log(`Production DB backup: ${result.backupPath}`);
      console.log(`Homepage hero media: ${result.homeHeroMediaId}`);
      console.log(`Yiyi cat: ${result.yiyiCatId}`);
    }
  }
} finally {
  await prisma.$disconnect();
}

async function buildAudit(hero) {
  const [home, yiyi, zhongling, hongdou, environmentPage, breedingPlanPage] = await Promise.all([
    prisma.fixedPage.findUnique({ where: { slug: "home" } }),
    prisma.cat.findUnique({
      where: { id: YIYI_CAT_ID },
      include: { breeding_profile: true },
    }),
    findCatByNames(["钟灵"]),
    findCatByNames(["红豆"]),
    prisma.fixedPage.findUnique({ where: { slug: "environment" } }),
    prisma.fixedPage.findUnique({ where: { slug: "breeding-plan" } }),
  ]);
  const existingHomeHero = await findExistingHeroMedia(hero.sha256);

  const audit = {
    mode: options.apply ? "apply" : "dry-run",
    sourceVersion: {
      demoLayoutCommit: "d5bcd5aaac7fc31eec207545d4ea998b67286388",
      webDemoManifest: "public-content-web-demo-2026-10-02",
      currentMain: "618c82bbca38a2f5887ce4b5932dc86e02af4ab2",
      currentUserUpdate: "incoming/starlitsky-demo-recovery-update/content-update.md",
    },
    blockers: [],
    pages: [],
    cats: [],
    preserved: [],
  };

  audit.pages.push({
    page: "home",
    productionCurrent: summarizeHome(home),
    recoveredTarget:
      "Use DEFAULT_HOMEPAGE_CONTENT structure with P01-home-hero.jpg as hero.slides[0].imageId; preserve existing later slides if present.",
    proposedAction: existingHomeHero
      ? `reuse existing media ${existingHomeHero.id} as first hero slide and publish home page`
      : "upload P01-home-hero.jpg to managed COS media, bind to fixed-page-home, use as first hero slide, publish home page",
    source: "content-update.md + P01-home-hero.jpg manifest sha256",
  });
  audit.pages.push({
    page: "environment",
    productionCurrent: summarizeEnvironment(environmentPage),
    recoveredTarget: "Keep current production environment content and media.",
    proposedAction:
      "No overwrite. This explicitly preserves the 10 environment photos added on 2026-10-08.",
    source: "production current data is later explicit decision",
  });
  audit.pages.push({
    page: "breeding-plan",
    productionCurrent: summarizeBreedingPlan(breedingPlanPage),
    recoveredTarget: "Keep current production pairings/identities.",
    proposedAction: "No overwrite.",
    source: "production current data is later explicit decision",
  });

  audit.cats.push({
    cat: "依依 / luoyiyi",
    productionCurrent: summarizeYiyi(yiyi),
    recoveredTarget: {
      name: "依依",
      color: "玳瑁麻纹加白（f2509）",
      story: YIYI_STORY,
      publicContentId: YIYI_PUBLIC_CONTENT_ID,
    },
    proposedAction:
      "update existing public-content-cat-luoyiyi record; keep publicContentId=luoyiyi and existing media; do not create duplicate",
    source: "content-update.md + src/lib/real-photo-manifest.generated.ts luoyiyi image mappings",
  });
  audit.cats.push({
    cat: "钟灵",
    productionCurrent: zhongling ? summarizeCat(zhongling) : "not found",
    recoveredTarget:
      "content-update.md supplies color and description, but recovered source only lists images under stud_requires_confirmation.",
    proposedAction:
      "Do not create or update because canonical record/category/status/media mapping is unresolved.",
    source: "content-update.md + real-photo manifest requires_confirmation",
  });
  audit.cats.push({
    cat: "红豆",
    productionCurrent: hongdou ? summarizeCat(hongdou) : "not found",
    recoveredTarget:
      "content-update.md supplies color and description, but recovered source only lists images under stud_requires_confirmation.",
    proposedAction:
      "Do not create or update because canonical record/category/status/media mapping is unresolved.",
    source: "content-update.md + real-photo manifest requires_confirmation",
  });

  if (!hero.valid) audit.blockers.push(hero.error);
  if (!yiyi) audit.blockers.push(`Missing required existing cat ${YIYI_CAT_ID}`);
  if (yiyi && readPublicContentId(yiyi) !== YIYI_PUBLIC_CONTENT_ID) {
    audit.blockers.push(`Existing ${YIYI_CAT_ID} does not have publicContentId=luoyiyi`);
  }

  audit.preserved.push("Bottom tabs: 首页 / 我们的猫 / 猫友圈");
  audit.preserved.push("Cats tabs: 小猫找家 / 种猫介绍");
  audit.preserved.push("Kitten filters: 找家中 / 待找家 / 已有家, default 找家中");
  audit.preserved.push("Environment 2026-10-08 production media/content");
  audit.preserved.push("Current production breeding-plan identities/pairings");

  return audit;
}

async function applyUpdate(hero) {
  const quickCheckBefore = await quickCheck();
  if (quickCheckBefore !== "ok") throw new Error(`PRAGMA quick_check failed: ${quickCheckBefore}`);
  const backupPath = createSqliteBackup();

  const homePage = await prisma.fixedPage.upsert({
    where: { slug: "home" },
    create: {
      id: HOME_PAGE_ID,
      slug: "home",
      title: "首页",
      status: "published",
      content_schema_version: 1,
      content_json: {},
      published_at: new Date(),
    },
    update: {},
  });

  let heroMedia = await findExistingHeroMedia(hero.sha256);
  if (!heroMedia) {
    const upload = await requestImageUpload({
      fileName: HERO_FILE_NAME,
      mimeType: "image/jpeg",
      sizeBytes: hero.sizeBytes,
      checksum: hero.sha256,
      width: hero.width,
      height: hero.height,
      title: "首页首图",
      altText: "星月缅因猫舍首页首图",
      ownerType: "fixed_page",
      ownerId: homePage.id,
      usage: "hero",
      sortOrder: 10,
    });
    const response = await fetch(upload.upload.url, {
      method: upload.upload.method,
      headers: upload.upload.headers,
      body: hero.bytes,
    });
    if (!response.ok) {
      throw new Error(`Hero image COS upload failed: HTTP ${response.status}`);
    }
    heroMedia = await completeMediaUpload(upload.media.id, {
      checksum: hero.sha256,
      sizeBytes: hero.sizeBytes,
      width: hero.width,
      height: hero.height,
    });
  }

  const existingHome = await prisma.fixedPage.findUnique({ where: { slug: "home" } });
  const nextHomeContent = buildHomeContent(existingHome?.content_json, heroMedia.id);
  await prisma.fixedPage.update({
    where: { slug: "home" },
    data: {
      title: "首页",
      status: "published",
      content_schema_version: 1,
      content_json: nextHomeContent,
      published_at: existingHome?.published_at ?? new Date(),
    },
  });

  const existingYiyi = await prisma.cat.findUnique({
    where: { id: YIYI_CAT_ID },
    include: { breeding_profile: true },
  });
  if (!existingYiyi) throw new Error(`Missing ${YIYI_CAT_ID}`);
  await prisma.cat.update({
    where: { id: YIYI_CAT_ID },
    data: {
      name: "依依",
      color: "玳瑁麻纹加白（f2509）",
      story_json: mergeYiyiStory(existingYiyi.story_json),
    },
  });
  await prisma.breedingCatProfile.update({
    where: { cat_id: YIYI_CAT_ID },
    data: {
      status_label: null,
      trait: null,
      source: "琥珀x洛阳",
    },
  });

  const quickCheckAfter = await quickCheck();
  if (quickCheckAfter !== "ok")
    throw new Error(`Post-apply PRAGMA quick_check failed: ${quickCheckAfter}`);

  return {
    backupPath,
    homeHeroMediaId: heroMedia.id,
    yiyiCatId: YIYI_CAT_ID,
    quickCheckBefore,
    quickCheckAfter,
  };
}

function readHeroFile(path) {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    return { valid: false, error: `Hero file missing: ${resolved}` };
  }
  const bytes = readFileSync(resolved);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const dimensions = readJpegDimensions(bytes);
  const valid = sha256 === HERO_SHA256 && bytes.length === HERO_BYTES;
  return {
    bytes,
    error: valid ? null : `Hero file mismatch: sha256=${sha256}, bytes=${bytes.length}`,
    height: dimensions.height,
    path: resolved,
    sha256,
    sizeBytes: bytes.length,
    valid,
    width: dimensions.width,
  };
}

function readJpegDimensions(buffer) {
  let offset = 2;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Hero file is not a JPEG");
  }
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions");
}

function buildHomeContent(existing, heroImageId) {
  const base = defaultHomeContent();
  const current = isPlainObject(existing) ? existing : {};
  const currentHero = isPlainObject(current.hero) ? current.hero : {};
  const currentSlides = Array.isArray(currentHero.slides) ? currentHero.slides : base.hero.slides;
  const laterSlides = currentSlides
    .filter((slide) => slide?.id !== "hero-1")
    .map((slide, index) => ({
      id: typeof slide?.id === "string" && slide.id ? slide.id : `hero-${index + 2}`,
      label:
        typeof slide?.label === "string" && slide.label ? slide.label : `首页轮播照片 ${index + 2}`,
      ...(typeof slide?.imageId === "string" && slide.imageId ? { imageId: slide.imageId } : {}),
    }));

  return {
    ...base,
    ...current,
    version: 1,
    hero: {
      ...base.hero,
      ...currentHero,
      slides: [{ id: "hero-1", label: "首页首图", imageId: heroImageId }, ...laterSlides],
    },
  };
}

function defaultHomeContent() {
  return {
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
        desc: "查看 2026 下半年繁育组合、预计时间与可能花色。",
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
}

function mergeYiyiStory(existing) {
  const storyJson = isPlainObject(existing) ? { ...existing } : {};
  const source = isPlainObject(storyJson.source) ? { ...storyJson.source } : {};
  return {
    ...storyJson,
    source: {
      ...source,
      publicContentId: YIYI_PUBLIC_CONTENT_ID,
      publicContentImportId: "breeding-cat-luoyiyi-from-web-demo",
      latestUserUpdate: "incoming/starlitsky-demo-recovery-update/content-update.md",
    },
    story: [YIYI_STORY],
  };
}

async function findExistingHeroMedia(checksum) {
  return prisma.mediaAsset.findFirst({
    where: {
      checksum,
      status: "active",
      deleted_at: null,
      bindings: {
        some: {
          owner_type: "fixed_page",
          owner_id: HOME_PAGE_ID,
          usage: "hero",
          visibility: "visible",
          deleted_at: null,
        },
      },
    },
    include: { bindings: true },
    orderBy: [{ created_at: "desc" }],
  });
}

async function findCatByNames(names) {
  return prisma.cat.findFirst({
    where: {
      deleted_at: null,
      OR: names.map((name) => ({ name })),
    },
    include: { breeding_profile: true, kitten_profile: true },
  });
}

function summarizeHome(page) {
  if (!page) return "virtual draft home page; no stored content/media";
  const slides = Array.isArray(page.content_json?.hero?.slides)
    ? page.content_json.hero.slides
    : [];
  return {
    status: page.status,
    slideCount: slides.length,
    firstSlide: slides[0] ?? null,
  };
}

function summarizeEnvironment(page) {
  const sections = Array.isArray(page?.content_json?.sections) ? page.content_json.sections : [];
  return {
    status: page?.status ?? "missing",
    updatedAt: page?.updated_at ?? null,
    sections: sections.length,
  };
}

function summarizeBreedingPlan(page) {
  const groups = Array.isArray(page?.content_json?.groups) ? page.content_json.groups : [];
  return {
    status: page?.status ?? "missing",
    pairings: groups.flatMap((group) => group.pairings ?? []).map((pairing) => pairing.id),
  };
}

function summarizeYiyi(cat) {
  if (!cat) return "missing";
  return {
    id: cat.id,
    publicContentId: readPublicContentId(cat),
    name: cat.name,
    color: cat.color,
    statusLabel: cat.breeding_profile?.status_label ?? null,
    reproductiveState: cat.breeding_profile?.reproductive_state ?? null,
    story: Array.isArray(cat.story_json?.story) ? cat.story_json.story : [],
  };
}

function summarizeCat(cat) {
  return {
    id: cat.id,
    name: cat.name,
    color: cat.color,
    hasBreedingProfile: Boolean(cat.breeding_profile),
    hasKittenProfile: Boolean(cat.kitten_profile),
  };
}

function readPublicContentId(cat) {
  const source = cat?.story_json?.source;
  return typeof source?.publicContentId === "string" ? source.publicContentId : null;
}

async function quickCheck() {
  const rows = await prisma.$queryRawUnsafe("PRAGMA quick_check");
  const first = Array.isArray(rows) ? rows[0] : null;
  return first?.quick_check ?? first?.["quick_check"] ?? JSON.stringify(rows);
}

function createSqliteBackup() {
  const sqlitePath = resolveSqlitePath(process.env.DATABASE_URL);
  const backupDir = process.env.SQLITE_BACKUP_DIR || defaultBackupDir(sqlitePath);
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(
    backupDir,
    `${basename(sqlitePath, ".sqlite")}-demo-recovery-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.sqlite`,
  );
  const sqlite3 = process.env.SQLITE3_BIN || "sqlite3";
  const result = spawnSync(sqlite3, [sqlitePath], {
    input: `.timeout 5000\n.backup '${backupPath.replaceAll("'", "''")}'\n`,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    rmSync(backupPath, { force: true });
    throw new Error(`SQLite backup failed: ${result.stderr || result.stdout}`);
  }
  chmodSync(backupPath, 0o600);
  verifyBackup(sqlite3, backupPath);
  return backupPath;
}

function verifyBackup(sqlite3, backupPath) {
  if (!existsSync(backupPath) || statSync(backupPath).size <= 0) {
    throw new Error(`SQLite backup was not created: ${backupPath}`);
  }
  const result = spawnSync(sqlite3, [backupPath], {
    input: ".timeout 5000\nPRAGMA quick_check;\nSELECT count(*) FROM sqlite_master;\n",
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout.includes("ok")) {
    throw new Error(`SQLite backup verification failed: ${result.stderr || result.stdout}`);
  }
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must be an explicit SQLite file: URL");
  }
  const rawPath = databaseUrl.slice("file:".length).replace(/^"|"$/g, "");
  return resolve(rawPath);
}

function defaultBackupDir(sqlitePath) {
  return sqlitePath.startsWith("/opt/starlitsky/data/")
    ? "/opt/starlitsky/backups/sqlite"
    : dirname(sqlitePath);
}

function parseArgs(argv) {
  const parsed = {
    apply: false,
    hero: "",
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      parsed.apply = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--hero") {
      parsed.hero = argv[++index];
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }
  if (!parsed.hero) throw new Error("--hero is required");
  return parsed;
}

function printAudit(audit) {
  console.log(`Demo recovery update ${audit.mode}`);
  console.log(`Blockers: ${audit.blockers.length}`);
  for (const page of audit.pages) {
    console.log(`Page ${page.page}: ${page.proposedAction}`);
  }
  for (const cat of audit.cats) {
    console.log(`Cat ${cat.cat}: ${cat.proposedAction}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
