import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { FIXED_PAGE_DEFINITIONS } from "./fixed-page-definitions.mjs";

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(CONTENT_DIR, "../../../..");
const DEMO_SOURCE_ROOT = resolve(REPO_ROOT, "src/lib");
const SOURCE_FILE_NAME = "src/lib Web Demo fixed-page content modules";

export const WEB_DEMO_FIXED_PAGE_MAPPING = [
  {
    slug: "about",
    fileName: "about-content.ts",
    exportName: "DEFAULT_ABOUT_CONTENT",
  },
  {
    slug: "philosophy",
    fileName: "philosophy-content.ts",
    exportName: "DEFAULT_PHILOSOPHY_CONTENT",
  },
  {
    slug: "environment",
    fileName: "environment-content.ts",
    exportName: "DEFAULT_ENVIRONMENT_CONTENT",
  },
  {
    slug: "feeding",
    fileName: "feeding-content.ts",
    exportName: "DEFAULT_FEEDING_CONTENT",
  },
  {
    slug: "process",
    fileName: "process-content.ts",
    exportName: "DEFAULT_PROCESS_CONTENT",
  },
  {
    slug: "aftercare",
    fileName: "aftercare-content.ts",
    exportName: "DEFAULT_AFTERCARE_CONTENT",
  },
  {
    slug: "contact",
    fileName: "contact-content.ts",
    exportName: "DEFAULT_CONTACT_CONTENT",
  },
];

export const WEB_DEMO_SOURCE_CONTENT = await loadWebDemoSourceContent();
export const WEB_DEMO_REAL_PHOTO_ASSETS = await loadWebDemoRealPhotoAssets();
export const WEB_DEMO_FIXED_PAGE_MEDIA = buildWebDemoFixedPageMedia(
  WEB_DEMO_SOURCE_CONTENT,
  WEB_DEMO_REAL_PHOTO_ASSETS,
);
export const WEB_DEMO_PUBLIC_CONTENT_MANIFEST = buildWebDemoPublicContentManifest(
  WEB_DEMO_SOURCE_CONTENT,
  WEB_DEMO_FIXED_PAGE_MEDIA,
);

export async function loadWebDemoSourceContent() {
  const moduleLoader = await createTypeScriptModuleLoader();
  return Object.fromEntries(
    WEB_DEMO_FIXED_PAGE_MAPPING.map((entry) => {
      const sourcePath = resolve(DEMO_SOURCE_ROOT, entry.fileName);
      const sourceModule = moduleLoader.load(sourcePath);
      const content = sourceModule[entry.exportName];
      if (!content || typeof content !== "object") {
        throw new Error(`Web Demo source export is missing: ${entry.fileName}#${entry.exportName}`);
      }
      return [entry.slug, cloneJson(content)];
    }),
  );
}

export function buildWebDemoPublicContentManifest(
  sourceContent = WEB_DEMO_SOURCE_CONTENT,
  fixedPageMedia = WEB_DEMO_FIXED_PAGE_MEDIA,
) {
  const titlesBySlug = new Map(FIXED_PAGE_DEFINITIONS.map((page) => [page.slug, page.title]));
  const fixedPages = WEB_DEMO_FIXED_PAGE_MAPPING.map((entry) => {
    const contentJson = sourceContent[entry.slug];
    if (!contentJson || typeof contentJson !== "object") {
      throw new Error(`Web Demo source content is missing for fixed page: ${entry.slug}`);
    }

    return {
      importId: `fixed-page-${entry.slug}-from-web-demo`,
      sourceHeading: `${entry.fileName} / ${entry.exportName}`,
      slug: entry.slug,
      title: titlesBySlug.get(entry.slug) ?? entry.slug,
      status: "published",
      contentSchemaVersion: Number.isInteger(contentJson.version) ? contentJson.version : 1,
      sourceCertainty: "direct",
      contentJson: cloneJson(contentJson),
    };
  });

  return {
    version: 1,
    manifestId: "public-content-web-demo-2026-10-02",
    manifestDate: "2026-10-02",
    fixedPageContentJsonMode: "replace",
    source: {
      fileName: SOURCE_FILE_NAME,
      extraction:
        "Direct TypeScript constant import from confirmed Web Demo content modules; text and structured fields only.",
    },
    fixedPages,
    fixedPageMedia,
    breedingCats: [],
    skippedSections: [
      {
        sourceHeading: "breeding-plan-content.ts",
        sourceParagraphs: [],
        reason: "out of scope",
        detail: "Breeding plan content is intentionally not imported in this batch.",
      },
      {
        sourceHeading: "media assets",
        sourceParagraphs: [],
        reason: "partially mapped",
        detail:
          "Canonical environment and feeding image identifiers are mapped to deterministic fixed-page MediaAsset imports. About hero and aftercare contract have no canonical asset identifiers in this PR head.",
      },
    ],
  };
}

export async function loadWebDemoRealPhotoAssets() {
  const moduleLoader = await createTypeScriptModuleLoader();
  const manifestModule = moduleLoader.load(resolve(DEMO_SOURCE_ROOT, "real-photo-manifest.generated.ts"));
  if (!Array.isArray(manifestModule.REAL_PHOTO_ASSETS)) {
    throw new Error("Web Demo real photo manifest is missing REAL_PHOTO_ASSETS");
  }
  return cloneJson(manifestModule.REAL_PHOTO_ASSETS);
}

export function buildWebDemoFixedPageMedia(
  sourceContent = WEB_DEMO_SOURCE_CONTENT,
  realPhotoAssets = WEB_DEMO_REAL_PHOTO_ASSETS,
) {
  const realAssetsById = new Map(realPhotoAssets.map((asset) => [asset.imageId, asset]));
  const items = [];

  items.push(...collectAboutHeroMedia(sourceContent.about, realAssetsById));
  items.push(...collectEnvironmentMedia(sourceContent.environment, realAssetsById));
  items.push(...collectFeedingMedia(sourceContent.feeding, realAssetsById));
  items.push(...collectAftercareMedia(sourceContent.aftercare, realAssetsById));

  return dedupeMediaItems(items);
}

function collectAboutHeroMedia(content, realAssetsById) {
  const slides = Array.isArray(content?.hero?.slides) ? content.hero.slides : [];
  return slides
    .map((slide, index) =>
      createImageMediaItem({
        altText: slide?.label,
        canonicalPath: `about.hero.slides.${index}.imageId`,
        imageId: slide?.imageId,
        realAssetsById,
        slug: "about",
        sortOrder: (index + 1) * 10,
        title: slide?.label,
        usage: index === 0 ? "cover" : "gallery",
      }),
    )
    .filter(Boolean);
}

function collectEnvironmentMedia(content, realAssetsById) {
  const items = [];
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  for (const [sectionIndex, section] of sections.entries()) {
    if (section?.coverImageId) {
      items.push(
        createImageMediaItem({
          altText: section.title,
          canonicalPath: `environment.sections.${sectionIndex}.coverImageId`,
          imageId: section.coverImageId,
          referenceOnly: true,
          realAssetsById,
          slug: "environment",
          sortOrder: (sectionIndex + 1) * 1000,
          title: section.title,
          usage: "cover",
        }),
      );
    }

    const rooms = Array.isArray(section?.rooms) ? section.rooms : [];
    for (const [roomIndex, room] of rooms.entries()) {
      const images = Array.isArray(room?.images) ? room.images : [];
      for (const [imageIndex, image] of images.entries()) {
        items.push(
          createImageMediaItem({
            altText: `${room.title ?? section.title ?? "Environment"} ${imageIndex + 1}`,
            canonicalPath: `environment.sections.${sectionIndex}.rooms.${roomIndex}.images.${imageIndex}.imageId`,
            imageId: image?.imageId,
            realAssetsById,
            slug: "environment",
            sortOrder: (sectionIndex + 1) * 1000 + (roomIndex + 1) * 100 + (imageIndex + 1) * 10,
            title: `${section.title ?? "Environment"} / ${room.title ?? `Room ${roomIndex + 1}`}`,
            usage: `environment:room:${room?.id ?? `room-${roomIndex + 1}`}`,
          }),
        );
      }
    }
  }
  return items.filter(Boolean);
}

function collectFeedingMedia(content, realAssetsById) {
  const items = [];
  const modules = Array.isArray(content?.modules) ? content.modules : [];
  for (const [moduleIndex, module] of modules.entries()) {
    const images = Array.isArray(module?.images) ? module.images : [];
    for (const [imageIndex, image] of images.entries()) {
      items.push(
        createImageMediaItem({
          altText: `${module.title ?? "Feeding"} ${imageIndex + 1}`,
          canonicalPath: `feeding.modules.${moduleIndex}.images.${imageIndex}.imageId`,
          imageId: image?.imageId,
          realAssetsById,
          slug: "feeding",
          sortOrder: (moduleIndex + 1) * 100 + (imageIndex + 1) * 10,
          title: module.title,
          usage: `feeding:module:${module?.id ?? `module-${moduleIndex + 1}`}`,
        }),
      );
    }
  }
  return items.filter(Boolean);
}

function collectAftercareMedia(content, realAssetsById) {
  const assetId = content?.contractFile?.assetId;
  if (!assetId) return [];
  return [
    createImageMediaItem({
      altText: content.contractFile.title,
      canonicalPath: "aftercare.contractFile.assetId",
      imageId: assetId,
      kind: "document",
      realAssetsById,
      slug: "aftercare",
      sortOrder: 10,
      title: content.contractFile.title,
      usage: "contract",
    }),
  ].filter(Boolean);
}

function createImageMediaItem({
  altText,
  canonicalPath,
  imageId,
  kind = "image",
  realAssetsById,
  referenceOnly = false,
  slug,
  sortOrder,
  title,
  usage,
}) {
  if (typeof imageId !== "string" || !imageId.trim()) return null;
  const asset = realAssetsById.get(imageId);
  if (!asset) {
    return {
      id: imageId,
      canonicalPath,
      kind,
      missingReason: "missing-real-photo-manifest-entry",
      ownerId: `fixed-page-${slug}`,
      ownerType: "fixed_page",
      referenceOnly,
      slug,
      sortOrder,
      usage,
    };
  }

  const sourcePath = resolve(REPO_ROOT, "public", trimLeadingSlash(asset.url));
  const file = existsSync(sourcePath) ? readFileSync(sourcePath) : null;
  const checksum = file ? createHash("sha256").update(file).digest("hex") : null;
  return {
    id: imageId,
    altText: altText ?? asset.roomTitle ?? asset.sectionTitle ?? title ?? null,
    canonicalPath,
    checksum,
    height: asset.outputHeight,
    kind,
    mimeType: "image/jpeg",
    missingReason: file ? null : "missing-local-source-file",
    ownerId: `fixed-page-${slug}`,
    ownerType: "fixed_page",
    referenceOnly,
    sizeBytes: file ? file.length : asset.outputSizeBytes,
    slug,
    sortOrder,
    sourceLocalPath: sourcePath,
    sourcePublicPath: asset.url,
    sourceRelativePath: asset.sourceRelativePath,
    target: asset.target,
    targetId: asset.targetId,
    title: title ?? asset.roomTitle ?? asset.sectionTitle ?? asset.originalFileName ?? imageId,
    usage,
    width: asset.outputWidth,
  };
}

function dedupeMediaItems(items) {
  const byId = new Map();
  for (const item of items) {
    if (!item) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    existing.references ??= [{ canonicalPath: existing.canonicalPath, usage: existing.usage }];
    existing.references.push({ canonicalPath: item.canonicalPath, usage: item.usage });
    if (existing.referenceOnly && !item.referenceOnly) {
      byId.set(item.id, {
        ...item,
        references: existing.references,
      });
    }
  }
  return [...byId.values()].sort((left, right) => {
    return (
      left.slug.localeCompare(right.slug) ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
    );
  });
}

function trimLeadingSlash(value) {
  return String(value ?? "").replace(/^[/\\]+/, "");
}

async function createTypeScriptModuleLoader() {
  const ts = await import("typescript");
  const moduleCache = new Map();

  function load(sourcePath) {
    const resolvedPath = resolveSourcePath(sourcePath);
    const cached = moduleCache.get(resolvedPath);
    if (cached) return cached.exports;

    assertInsideDemoSourceRoot(resolvedPath);

    const module = { exports: {} };
    moduleCache.set(resolvedPath, module);

    const source = readFileSync(resolvedPath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
      fileName: resolvedPath,
    }).outputText;

    const script = new vm.Script(transpiled, { filename: resolvedPath });
    const localRequire = (specifier) => {
      if (!specifier.startsWith(".")) {
        throw new Error(`Unsupported Web Demo source import "${specifier}" in ${resolvedPath}`);
      }
      return load(resolve(dirname(resolvedPath), specifier));
    };

    script.runInNewContext({
      exports: module.exports,
      module,
      require: localRequire,
      console,
      structuredClone,
    });

    return module.exports;
  }

  return { load };
}

function resolveSourcePath(sourcePath) {
  const normalized = resolve(sourcePath);
  if (existsSync(normalized)) return normalized;
  if (extname(normalized) === ".ts") return normalized;
  return `${normalized}.ts`;
}

function assertInsideDemoSourceRoot(sourcePath) {
  const normalizedRoot = `${resolve(DEMO_SOURCE_ROOT)}\\`.replaceAll("\\", "/");
  const normalizedPath = resolve(sourcePath).replaceAll("\\", "/");
  if (!normalizedPath.startsWith(normalizedRoot)) {
    throw new Error(`Web Demo source import is outside src/lib: ${sourcePath}`);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
