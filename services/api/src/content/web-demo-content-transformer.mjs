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
export const WEB_DEMO_PUBLIC_CONTENT_MANIFEST = buildWebDemoPublicContentManifest(
  WEB_DEMO_SOURCE_CONTENT,
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

export function buildWebDemoPublicContentManifest(sourceContent = WEB_DEMO_SOURCE_CONTENT) {
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
        reason: "media upload deferred",
        detail:
          "Existing image and asset identifiers in content JSON are preserved where present, but no MediaAsset rows are created or uploaded.",
      },
    ],
  };
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
