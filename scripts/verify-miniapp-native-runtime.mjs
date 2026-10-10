#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { WEB_DEMO_PUBLIC_CONTENT_MANIFEST } from "../services/api/src/content/web-demo-content-transformer.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const miniappRoot = join(repoRoot, "apps/miniapp");
const projectConfigPath = join(miniappRoot, "project.config.json");
const appJsonPath = join(miniappRoot, "app.json");
const envPath = join(miniappRoot, "config/env.ts");

const failures = [];
const runtimeImports = [];
const typeOnlyImports = [];

verifyProjectConfig();
verifyProductionEnvGuards();
verifyPageRegistrations();
verifyMobileParityTabBar();
verifyVisualQaFixtures();
verifyVisualQaMutationGuards();
verifyFixedPageNormalization();
verifyCatPhotoRenderingInvariants();
verifyRuntimeImports();
verifyWxssCompatibility();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  [
    "Miniapp native runtime verification passed.",
    `Runtime imports checked: ${runtimeImports.length}.`,
    `Type-only imports ignored: ${typeOnlyImports.length}.`,
  ].join(" "),
);

function verifyProjectConfig() {
  const projectConfig = readJson(projectConfigPath);
  if (projectConfig.appid !== "wx6d3a94b9d6eadeaa") {
    failures.push("apps/miniapp/project.config.json must preserve the real WeChat AppID.");
  }
  if (projectConfig.appid === "touristappid") {
    failures.push("apps/miniapp/project.config.json must not use touristappid.");
  }
  if (Object.hasOwn(projectConfig, "useCompilerPlugins")) {
    failures.push(
      'apps/miniapp/project.config.json must not set top-level "useCompilerPlugins"; put it under "setting".',
    );
  }
  const compilerPlugins = projectConfig.setting?.useCompilerPlugins;
  if (!Array.isArray(compilerPlugins)) {
    failures.push(
      'apps/miniapp/project.config.json must set "setting.useCompilerPlugins" to an array.',
    );
  } else if (
    compilerPlugins.length !== 1 ||
    compilerPlugins[0] !== "typescript"
  ) {
    failures.push(
      'apps/miniapp/project.config.json must set "setting.useCompilerPlugins": ["typescript"].',
    );
  }
  if (Object.hasOwn(projectConfig, "compilerPlugins")) {
    failures.push("apps/miniapp/project.config.json must not use unsupported compilerPlugins.");
  }
}

function verifyProductionEnvGuards() {
  const envText = readFileSync(envPath, "utf8");
  const miniappText = listTextFiles(miniappRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  if (/\btouristappid\b/.test(miniappText)) {
    failures.push("apps/miniapp must not contain touristappid.");
  }
  const productionBaseUrlMatch = envText.match(
    /MINIAPP_PRODUCTION_API_BASE_URL\s*=\s*"([^"]+)"/,
  );
  if (!productionBaseUrlMatch || productionBaseUrlMatch[1].trim() === "") {
    failures.push("MINIAPP_PRODUCTION_API_BASE_URL must be a non-blank literal.");
  }
  for (const envVersion of ["trial", "release"]) {
    const match = envText.match(new RegExp(`${envVersion}:\\s*([^,\\n]+)`));
    if (!match || match[1].trim() === '""') {
      failures.push(`Miniapp ${envVersion} API base URL must not be blank.`);
    }
  }
  const developMatch = envText.match(/develop:\s*([^,\n]+)/);
  if (!developMatch || /127\.0\.0\.1|localhost/.test(developMatch[1])) {
    failures.push("Miniapp develop API base URL must default to the production HTTPS API.");
  }
  if (/http:\/\/127\.0\.0\.1:4310|localhost/.test(miniappText)) {
    failures.push("apps/miniapp must not contain loopback API defaults.");
  }
  if (/MINIAPP_LOCAL_API_BASE_URL_STORAGE_KEY|getExplicitLocalApiBaseUrl|localApiBaseUrl/i.test(envText)) {
    failures.push("Miniapp API base URL must not be overridable from local storage.");
  }
}

function verifyPageRegistrations() {
  const appJson = readJson(appJsonPath);
  if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
    failures.push("apps/miniapp/app.json must list at least one page.");
    return;
  }

  for (const page of appJson.pages) {
    const pageTsPath = join(miniappRoot, `${page}.ts`);
    const pageJsonPath = join(miniappRoot, `${page}.json`);
    if (!existsSync(pageTsPath)) {
      failures.push(`app.json page "${page}" is missing ${page}.ts.`);
      continue;
    }
    if (!existsSync(pageJsonPath)) {
      failures.push(`app.json page "${page}" is missing ${page}.json.`);
    }
    const text = readFileSync(pageTsPath, "utf8");
    if (!/\bPage\s*\(/.test(text)) {
      failures.push(`app.json page "${page}" must register with Page(...).`);
    }
  }
}

function verifyMobileParityTabBar() {
  const appJson = readJson(appJsonPath);
  const expectedTabs = [
    ["pages/home/index", "首页", "assets/tabbar/home.png", "assets/tabbar/home-active.png"],
    ["pages/cats/index", "我们的猫", "assets/tabbar/cats.png", "assets/tabbar/cats-active.png"],
    [
      "pages/community/index",
      "猫友圈",
      "assets/tabbar/community.png",
      "assets/tabbar/community-active.png",
    ],
  ];
  const tabs = appJson.tabBar?.list;
  if (!Array.isArray(tabs) || tabs.length !== expectedTabs.length) {
    failures.push("apps/miniapp/app.json tabBar must match the 3-item React PhoneFrame navigation.");
    return;
  }

  for (const [index, [pagePath, text, iconPath, selectedIconPath]] of expectedTabs.entries()) {
    const tab = tabs[index];
    if (
      tab?.pagePath !== pagePath ||
      tab?.text !== text ||
      tab?.iconPath !== iconPath ||
      tab?.selectedIconPath !== selectedIconPath
    ) {
      failures.push(
        `apps/miniapp/app.json tabBar item ${index + 1} must be ${pagePath} / ${text} with local icon assets.`,
      );
    }
    for (const asset of [iconPath, selectedIconPath]) {
      if (!existsSync(join(miniappRoot, asset))) {
        failures.push(`Missing miniapp tabBar icon asset: apps/miniapp/${asset}.`);
      }
    }
  }

  const homeWxmlPath = join(miniappRoot, "pages/home/index.wxml");
  const homeWxml = readFileSync(homeWxmlPath, "utf8");
  for (const forbidden of ["⌁", "●", "✦", "☾"]) {
    if (homeWxml.includes(forbidden)) {
      failures.push(
        `apps/miniapp/pages/home/index.wxml must use migrated visual assets instead of decorative character "${forbidden}".`,
      );
    }
  }

  const characterIconSubstitutes = ["⌁", "●", "○", "✦", "☾", "＋", "×"];
  for (const wxmlPath of listTextFiles(miniappRoot).filter((path) => path.endsWith(".wxml"))) {
    const source = readFileSync(wxmlPath, "utf8");
    for (const forbidden of characterIconSubstitutes) {
      if (source.includes(forbidden)) {
        failures.push(
          `${relative(repoRoot, wxmlPath)} must use local visual assets instead of character icon substitute "${forbidden}".`,
        );
      }
    }
  }
}

function verifyVisualQaFixtures() {
  const adapterPath = join(miniappRoot, "utils/visual-qa/adapter.ts");
  const modePath = join(miniappRoot, "utils/visual-qa/mode.ts");
  const fixturePath = join(miniappRoot, "utils/visual-qa/fixtures.ts");
  const publicContentPath = join(miniappRoot, "utils/public-content/index.ts");
  const appPath = join(miniappRoot, "app.ts");
  for (const requiredPath of [adapterPath, modePath, fixturePath]) {
    if (!existsSync(requiredPath)) {
      failures.push(`${relative(repoRoot, requiredPath)} is required for explicit Visual QA fixture mode.`);
    }
  }
  if (!existsSync(adapterPath) || !existsSync(modePath) || !existsSync(publicContentPath)) return;

  const adapterText = readFileSync(adapterPath, "utf8");
  const modeText = readFileSync(modePath, "utf8");
  const publicContentText = readFileSync(publicContentPath, "utf8");
  const appText = readFileSync(appPath, "utf8");
  if (!modeText.includes('VISUAL_QA_QUERY_KEY = "visualQa"')) {
    failures.push("Visual QA fixture mode must use the explicit visualQa query key.");
  }
  if (!/query\[VISUAL_QA_QUERY_KEY\]\s*===\s*"1"/.test(modeText)) {
    failures.push("Visual QA fixture mode must require visualQa=1.");
  }
  if (!/getMiniProgramEnvVersion\(\)\s*===\s*"develop"/.test(modeText)) {
    failures.push("Visual QA fixture mode must be disabled outside develop.");
  }
  if (!appText.includes("configureVisualQaAdapter(options?.query)")) {
    failures.push("App launch must configure the Visual QA adapter from the explicit launch query.");
  }
  if (!adapterText.includes("setPublicContentAdapter")) {
    failures.push("Visual QA fixtures must enter through the independent public content adapter.");
  }
  if (/VisualQa|visualQa|visual-qa|isVisualQaModeEnabled/.test(publicContentText)) {
    failures.push("Production public content helpers must not contain Visual QA fixture branches.");
  }
  if (/catch\s*\([^)]*\)\s*\{[^}]*VisualQa/s.test(publicContentText)) {
    failures.push("Visual QA fixtures must not be used as an API failure fallback.");
  }
}

function verifyVisualQaMutationGuards() {
  const requestPath = join(miniappRoot, "utils/request/index.ts");
  const publicContentPath = join(miniappRoot, "utils/public-content/index.ts");
  const adapterPath = join(miniappRoot, "utils/visual-qa/adapter.ts");
  const fixturePath = join(miniappRoot, "utils/visual-qa/fixtures.ts");
  const communityPostImagesPath = join(miniappRoot, "utils/community-post-images.ts");
  if (![requestPath, publicContentPath, adapterPath, fixturePath, communityPostImagesPath].every(existsSync)) return;

  const requestText = readFileSync(requestPath, "utf8");
  const publicContentText = readFileSync(publicContentPath, "utf8");
  const adapterText = readFileSync(adapterPath, "utf8");
  const fixtureText = readFileSync(fixturePath, "utf8");
  const communityPostImagesText = readFileSync(communityPostImagesPath, "utf8");

  if (/VisualQa|visualQa|visual-qa|isVisualQaModeEnabled|VISUAL_QA_MUTATION_BLOCKED/.test(requestText)) {
    failures.push("Production request wrapper must not contain Visual QA mutation branches.");
  }
  if (/VisualQa|visualQa|visual-qa|isVisualQaModeEnabled/.test(publicContentText)) {
    failures.push("Production public content helper must not contain Visual QA mutation branches.");
  }

  const guardedMutations = [
    ["createCommunityPost", "createVisualQaCommunityPost"],
    ["updateCommunityPost", "updateVisualQaCommunityPost"],
    ["deleteCommunityPost", "deleteVisualQaCommunityPost"],
    ["toggleCommunityPostLike", "toggleVisualQaCommunityPostLike"],
    ["createCommunityComment", "createVisualQaCommunityComment"],
    ["deleteCommunityComment", "deleteVisualQaCommunityComment"],
    ["requestCommunityPostImageUpload", "requestVisualQaCommunityPostImageUpload"],
    ["completeCommunityPostImageUpload", "completeVisualQaCommunityPostImageUpload"],
    ["deleteCommunityPostImage", "deleteVisualQaCommunityPostImage"],
    ["submitSelectionApplication", "submitVisualQaSelectionApplication"],
  ];
  for (const [publicFunction, fixtureFunction] of guardedMutations) {
    if (!new RegExp(`${publicFunction}:\\s*${fixtureFunction}`).test(adapterText)) {
      failures.push(
        `apps/miniapp/utils/visual-qa/adapter.ts must route ${publicFunction} to ${fixtureFunction}.`,
      );
    }
    if (!new RegExp(`function\\s+${fixtureFunction}\\b`).test(fixtureText)) {
      failures.push(`Missing Visual QA fixture mutation helper: ${fixtureFunction}.`);
    }
  }

  if (!adapterText.includes("setPostImageUploadAdapter")) {
    failures.push("Community post image upload QA behavior must be installed through the Visual QA adapter.");
  }
  if (/VisualQa|visualQa|visual-qa|isVisualQaModeEnabled/.test(communityPostImagesText)) {
    failures.push("Production community post image upload helper must not contain Visual QA branches.");
  }
}

function verifyFixedPageNormalization() {
  const fixedPageContentPath = join(miniappRoot, "utils/fixed-page-content.ts");
  if (!existsSync(fixedPageContentPath)) {
    failures.push("apps/miniapp/utils/fixed-page-content.ts is required.");
    return;
  }

  const fixedPageContentText = readFileSync(fixedPageContentPath, "utf8");
  const environmentPage = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages.find(
    (page) => page.slug === "environment",
  );
  if (!environmentPage) {
    failures.push("Web Demo public content manifest must include the environment fixed page.");
    return;
  }

  const normalized = evaluateFixedPageContentModule(fixedPageContentText);
  const view = normalized.normalizeFixedPageView(
    "environment",
    environmentPage.title,
    environmentPage.contentJson,
    [],
  );
  const expectedSections = environmentPage.contentJson.sections;
  if (!Array.isArray(expectedSections)) {
    failures.push("Web Demo environment contentJson.sections must be an array.");
    return;
  }

  if (view.environmentSections.length !== expectedSections.length) {
    failures.push(
      `Environment normalization must preserve all canonical Web Demo sections; expected ${expectedSections.length}, got ${view.environmentSections.length}.`,
    );
  }

  const commonSection = view.environmentSections.find(
    (section) => section.id === "environment-zone-common",
  );
  if (!commonSection) {
    failures.push(
      "Environment normalization must keep environment-zone-common even when it has zero media.",
    );
    return;
  }
  if (commonSection.photoCount !== 0) {
    failures.push("environment-zone-common fixture should verify the zero-media section path.");
  }
  if (!commonSection.summary.includes("公区主要作为人类生活区")) {
    failures.push("environment-zone-common summary text must survive normalization.");
  }
  if (!commonSection.rooms.some((room) => room.title === "客厅活动区")) {
    failures.push("environment-zone-common room titles must survive normalization.");
  }

  const breedingPage = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages.find(
    (page) => page.slug === "breeding-plan",
  );
  if (!breedingPage) {
    failures.push("Web Demo public content manifest must include the breeding-plan fixed page.");
    return;
  }
  verifyBreedingPlanIdentityResolution(normalized, breedingPage);

  const breedingCats = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.map((entry) =>
    createBreedingCatApiFixture(entry),
  );
  const breedingView = normalized.normalizeFixedPageView(
    "breeding-plan",
    breedingPage.title,
    breedingPage.contentJson,
    [],
    breedingCats,
  );
  const pairings = breedingView.breedingGroups.flatMap((group) => group.pairings);
  if (pairings.length !== 10) {
    failures.push(`Breeding-plan normalization must keep 10 canonical pairings; got ${pairings.length}.`);
  }
  for (const pairing of pairings) {
    if (!pairing.male || !pairing.female) {
      failures.push(`Breeding-plan pairing ${pairing.id} must resolve both cats by publicContentId.`);
    }
  }
  const yunyuePairing = pairings.find((pairing) => pairing.id === "tianhe-yunyue-2026-h2");
  if (!yunyuePairing?.female || yunyuePairing.female.id !== "public-content-cat-yunyue") {
    failures.push("Breeding-plan normalization must resolve yunyue even without media.");
  } else if (yunyuePairing.female.imageUrl !== "") {
    failures.push("Yunyue must keep the no-image placeholder path when no media is available.");
  }

  const productionShapeBreedingCats = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.map((entry) =>
    createBreedingCatApiFixture(entry, { currentProductionIdentityShape: true }),
  );
  const productionShapeView = normalized.normalizeFixedPageView(
    "breeding-plan",
    breedingPage.title,
    breedingPage.contentJson,
    [],
    productionShapeBreedingCats,
  );
  const productionShapePairings = productionShapeView.breedingGroups.flatMap((group) => group.pairings);
  if (productionShapePairings.length !== 10) {
    failures.push(
      `Breeding-plan current-production-shape normalization must keep 10 canonical pairings; got ${productionShapePairings.length}.`,
    );
  }
  for (const pairing of productionShapePairings) {
    if (!pairing.male || !pairing.female) {
      failures.push(
        `Breeding-plan pairing ${pairing.id} must resolve both cats when publicContentId only exists in storyJson.source.`,
      );
    }
  }
}

function verifyBreedingPlanIdentityResolution(normalized, breedingPage) {
  const identityCases = [
    createMinimalBreedingCatFixture({
      id: "legacy-row-for-top-level-case",
      publicContentId: "top-level-case",
      storyJson: { source: { publicContentId: "wrong-story-case" } },
    }),
    createMinimalBreedingCatFixture({
      id: "legacy-row-for-story-source-case",
      storyJson: { source: { publicContentId: "story-source-case" } },
    }),
    createMinimalBreedingCatFixture({
      id: "public-content-cat-db-fallback-case",
      storyJson: { source: {} },
    }),
  ];
  const identityView = normalized.normalizeFixedPageView(
    "breeding-plan",
    breedingPage.title,
    {
      groups: [
        {
          id: "identity-resolution-cases",
          pairings: [
            {
              id: "identity-top-level-and-story-source",
              maleStudId: "top-level-case",
              femaleStudId: "story-source-case",
            },
            {
              id: "identity-db-fallback",
              maleStudId: "db-fallback-case",
              femaleStudId: "top-level-case",
            },
          ],
        },
      ],
    },
    [],
    identityCases,
  );
  const pairings = identityView.breedingGroups.flatMap((group) => group.pairings);
  const topLevelAndStory = pairings.find((pairing) => pairing.id === "identity-top-level-and-story-source");
  if (
    topLevelAndStory?.male?.id !== "legacy-row-for-top-level-case" ||
    topLevelAndStory?.female?.id !== "legacy-row-for-story-source-case"
  ) {
    failures.push(
      "Breeding-plan identity resolution must support top-level publicContentId and storyJson.source.publicContentId.",
    );
  }
  const fallback = pairings.find((pairing) => pairing.id === "identity-db-fallback");
  if (
    fallback?.male?.id !== "public-content-cat-db-fallback-case" ||
    fallback?.female?.id !== "legacy-row-for-top-level-case"
  ) {
    failures.push("Breeding-plan identity resolution must keep normalized DB id fallback.");
  }
}

function verifyCatPhotoRenderingInvariants() {
  const catPresentationPath = join(miniappRoot, "utils/cat-presentation.ts");
  const catsPagePath = join(miniappRoot, "pages/cats/index.ts");
  const catsWxmlPath = join(miniappRoot, "pages/cats/index.wxml");
  const detailPagePath = join(miniappRoot, "pages/cat-detail/index.ts");
  const detailWxmlPath = join(miniappRoot, "pages/cat-detail/index.wxml");
  const fixedPageContentPath = join(miniappRoot, "utils/fixed-page-content.ts");
  const fixedPageWxmlPath = join(miniappRoot, "pages/fixed-page/index.wxml");

  for (const requiredPath of [
    catPresentationPath,
    catsPagePath,
    catsWxmlPath,
    detailPagePath,
    detailWxmlPath,
    fixedPageContentPath,
    fixedPageWxmlPath,
  ]) {
    if (!existsSync(requiredPath)) {
      failures.push(`${toRepoPath(requiredPath)} is required for cat photo rendering verification.`);
      return;
    }
  }

  const catPresentationText = readFileSync(catPresentationPath, "utf8");
  if (/\bscaleToFill\b/.test(catPresentationText)) {
    failures.push("Cat photo presentation must not resolve core cat thumbnails to scaleToFill.");
  }

  const catsPageText = readFileSync(catsPagePath, "utf8");
  const detailPageText = readFileSync(detailPagePath, "utf8");
  const fixedPageContentText = readFileSync(fixedPageContentPath, "utf8");
  for (const [path, text] of [
    [catsPagePath, catsPageText],
    [detailPagePath, detailPageText],
    [fixedPageContentPath, fixedPageContentText],
  ]) {
    if (/mode\s*={3}\s*"scaleToFill"|mode\s*===\s*"scaleToFill"|manual-crop-image/.test(text)) {
      failures.push(`${toRepoPath(path)} must not branch cat content photos through scaleToFill.`);
    }
  }

  const catsWxml = readFileSync(catsWxmlPath, "utf8");
  const detailWxml = readFileSync(detailWxmlPath, "utf8");
  const fixedPageWxml = readFileSync(fixedPageWxmlPath, "utf8");
  if (!catsWxml.includes('mode="{{item.imageMode}}"')) {
    failures.push("Our Cats list images must bind the resolved imageMode instead of omitting mode.");
  }
  if (!detailWxml.includes('mode="{{item.mode}}"')) {
    failures.push("Cat detail gallery images must bind the resolved image mode instead of omitting mode.");
  }
  for (const requiredBinding of ['mode="{{pairing.male.imageMode}}"', 'mode="{{pairing.female.imageMode}}"']) {
    if (!fixedPageWxml.includes(requiredBinding)) {
      failures.push(`Breeding-plan stud cards must bind ${requiredBinding}.`);
    }
  }

  const presentation = evaluateCatPresentationModule(catPresentationText);
  const listAspectRatio = 16 / 10;
  const mediaCases = [
    createCatMedia("portrait", 800, 1600),
    createCatMedia("landscape", 1600, 800),
    createCatMedia("square", 1200, 1200),
  ];

  for (const media of mediaCases) {
    const frame = presentation.resolveCatFrame(createCatFixture({ mediaAssets: [media] }), "listCard");
    assertPhotoFrame(frame, {
      aspectRatio: listAspectRatio,
      description: `listCard ${media.id} fallback cover`,
      expectedId: media.id,
      naturalHeight: media.height,
      naturalWidth: media.width,
      requirePositionedCover: true,
    });
  }

  const cropFrame = presentation.resolveCatFrame(
    createCatFixture({
      entryCoverSelections: {
        listCard: {
          imageId: "portrait",
          cropRect: { x: 0.1, y: 0.2, width: 0.5, height: 0.25 },
        },
      },
      mediaAssets: mediaCases,
    }),
    "listCard",
  );
  assertPhotoFrame(cropFrame, {
    aspectRatio: listAspectRatio,
    description: "listCard manual crop",
    expectedId: "portrait",
    naturalHeight: 1600,
    naturalWidth: 800,
    requirePositionedCover: true,
  });

  const invalidCropFrame = presentation.resolveCatFrame(
    createCatFixture({
      entryCoverSelections: {
        listCard: {
          imageId: "landscape",
          cropRect: { x: 0.2, y: 0.2, width: 0, height: 0.4 },
        },
      },
      mediaAssets: mediaCases,
    }),
    "listCard",
  );
  assertPhotoFrame(invalidCropFrame, {
    aspectRatio: listAspectRatio,
    description: "listCard invalid crop fallback",
    expectedId: "landscape",
    naturalHeight: 800,
    naturalWidth: 1600,
    requirePositionedCover: true,
  });

  const missingDimensionsCropFrame = presentation.resolveCatFrame(
    createCatFixture({
      entryCoverSelections: {
        listCard: {
          imageId: "no-dimensions",
          cropRect: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
        },
      },
      mediaAssets: [createCatMedia("no-dimensions", null, null)],
    }),
    "listCard",
  );
  assertPhotoFrame(missingDimensionsCropFrame, {
    aspectRatio: listAspectRatio,
    description: "listCard crop without dimensions fallback",
    expectedId: "no-dimensions",
    requireAspectFillFallback: true,
  });

  const detailFrames = presentation.resolveCatDetailFrames(
    createCatFixture({
      detailImagePresentations: {
        portrait: {
          mode: "crop",
          cropRect: { x: 0.08, y: 0.18, width: 0.7, height: 0.56 },
        },
        landscape: {
          mode: "original",
        },
      },
      mediaAssets: mediaCases,
    }),
  );
  const detailCrop = detailFrames.find((frame) => frame.id === "portrait");
  assertPhotoFrame(detailCrop, {
    aspectRatio: 4 / 5,
    description: "detail gallery manual crop",
    expectedId: "portrait",
    naturalHeight: 1600,
    naturalWidth: 800,
    requirePositionedCover: true,
  });
  const detailOriginal = detailFrames.find((frame) => frame.id === "landscape");
  if (!detailOriginal || detailOriginal.mode !== "aspectFit" || detailOriginal.style !== "") {
    failures.push("detail gallery original mode must render as unstretched aspectFit without positioned crop style.");
  }
}

function createBreedingCatApiFixture(entry, { currentProductionIdentityShape = false } = {}) {
  return {
    id: entry.cat.id,
    ...(currentProductionIdentityShape ? {} : { publicContentId: entry.cat.publicContentId }),
    name: entry.cat.name,
    color: entry.cat.color,
    storyJson: {
      source: {
        publicContentId: entry.cat.publicContentId,
      },
    },
    breedingProfile: {
      catId: entry.cat.id,
      category: entry.breedingProfile.breedingRole,
      reproductiveState: entry.breedingProfile.reproductiveState,
      statusLabel: entry.breedingProfile.statusLabel,
      trait: entry.breedingProfile.trait,
      source: entry.breedingProfile.source,
      sortOrder: entry.breedingProfile.sortOrder,
    },
    mediaAssets: WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia
      .filter((item) => item.ownerId === entry.cat.id)
      .map((item) => ({
        id: item.id,
        sourceUrl: `https://media.verify.example/${item.id}`,
        thumbnailUrl: "",
        usage: item.usage,
        sortOrder: item.sortOrder,
      })),
  };
}

function createMinimalBreedingCatFixture({ id, publicContentId, storyJson }) {
  return {
    id,
    ...(publicContentId ? { publicContentId } : {}),
    name: id,
    color: "verify",
    storyJson,
    breedingProfile: {
      catId: id,
      category: "king",
      reproductiveState: "active",
      statusLabel: "verify",
      trait: "",
      source: "",
      sortOrder: 1,
    },
    mediaAssets: [],
  };
}

function createCatFixture({
  detailImagePresentations,
  entryCoverSelections,
  mediaAssets,
} = {}) {
  return {
    id: "verify-cat",
    name: "verify cat",
    mediaAssets: mediaAssets ?? [],
    detailImagePresentations,
    entryCoverSelections,
  };
}

function createCatMedia(id, width, height) {
  return {
    id,
    kind: "image",
    sourceUrl: `https://media.verify.example/${id}.jpg`,
    thumbnailUrl: null,
    usage: id === "landscape" ? "gallery" : "cover",
    sortOrder: id === "portrait" ? 1 : id === "landscape" ? 2 : 3,
    width,
    height,
  };
}

function assertPhotoFrame(
  frame,
  {
    aspectRatio,
    description,
    expectedId,
    naturalHeight,
    naturalWidth,
    requireAspectFillFallback = false,
    requirePositionedCover = false,
  },
) {
  if (!frame) {
    failures.push(`${description} must resolve a frame.`);
    return;
  }
  if (frame.id !== expectedId) {
    failures.push(`${description} must resolve media "${expectedId}", got "${frame.id}".`);
  }
  if (frame.mode === "scaleToFill") {
    failures.push(`${description} must not use scaleToFill.`);
  }
  if (!frame.mode) {
    failures.push(`${description} must set an explicit image mode.`);
  }
  if (requireAspectFillFallback) {
    if (frame.mode !== "aspectFill" || frame.style !== "") {
      failures.push(`${description} must safely fall back to centered aspectFill when dimensions are missing.`);
    }
    return;
  }
  if (!requirePositionedCover) return;

  const style = parseInlineStyle(frame.style);
  const width = styleNumber(style.width);
  const height = styleNumber(style.height);
  const left = styleNumber(style.left);
  const top = styleNumber(style.top);
  if ([width, height, left, top].some((value) => value == null)) {
    failures.push(`${description} must provide positioned width, height, left, and top percentages.`);
    return;
  }
  if (frame.mode !== "aspectFit") {
    failures.push(`${description} must use aspectFit for internally positioned images to avoid stretch.`);
  }
  if (width < 99.9 || height < 99.9) {
    failures.push(`${description} must cover the fixed frame; got ${width}% x ${height}%.`);
  }
  if (naturalWidth && naturalHeight) {
    const renderedRatio = width / (height / aspectRatio);
    const naturalRatio = naturalWidth / naturalHeight;
    if (Math.abs(renderedRatio - naturalRatio) > 0.005) {
      failures.push(
        `${description} must preserve natural image ratio; got ${renderedRatio.toFixed(4)}, expected ${naturalRatio.toFixed(4)}.`,
      );
    }
  }
}

function parseInlineStyle(styleText) {
  return Object.fromEntries(
    String(styleText || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colon = part.indexOf(":");
        return colon >= 0
          ? [part.slice(0, colon).trim(), part.slice(colon + 1).trim()]
          : [part, ""];
      }),
  );
}

function styleNumber(value) {
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function evaluateFixedPageContentModule(sourceText) {
  const runtimeSource = sourceText
    .replace(/^import[^\n]*\n/gm, "")
    .replace(/^export\s+/gm, "");
  const compiled = ts.transpileModule(
    `${runtimeSource}
module.exports = { normalizeFixedPageView };`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: "fixed-page-content.ts",
    },
  ).outputText;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    resolveCatFrame: () => null,
    getFixedPageMediaUrl: () => "",
    mapFixedPageMedia: () => ({ coverMedia: null, galleryMedia: [], previewMedia: [] }),
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: "fixed-page-content.ts" });
  return sandbox.module.exports;
}

function evaluateCatPresentationModule(sourceText) {
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "cat-presentation.ts",
  }).outputText;

  const sandbox = {
    module: { exports: {} },
    exports: {},
  };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: "cat-presentation.ts" });
  return sandbox.module.exports;
}

function verifyRuntimeImports() {
  const tsFiles = listTextFiles(miniappRoot).filter(
    (path) => path.endsWith(".ts") && !path.endsWith(".d.ts"),
  );

  for (const filePath of tsFiles) {
    const sourceFile = ts.createSourceFile(
      filePath,
      readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    visitImports(sourceFile, (record) => {
      const relativeSource = toRepoPath(record.sourceFile);
      if (record.typeOnly) {
        typeOnlyImports.push(record);
        return;
      }
      runtimeImports.push(record);

      if (!record.specifier.startsWith(".")) {
        failures.push(
          `${relativeSource}: runtime import "${record.specifier}" must be relative for native WeChat packaging.`,
        );
        return;
      }

      const resolvedBase = resolve(dirname(record.sourceFile), record.specifier);
      if (existsSync(resolvedBase) && statSync(resolvedBase).isDirectory()) {
        const indexPath = join(resolvedBase, "index.ts");
        const target = toRepoPath(indexPath);
        failures.push(
          `${relativeSource}: runtime directory import "${record.specifier}" targets ${target}; import "${record.specifier}/index" instead.`,
        );
      }

      if (extname(record.specifier) === ".ts") {
        failures.push(
          `${relativeSource}: runtime import "${record.specifier}" must not include a .ts extension for WeChat runtime output.`,
        );
      }
    });
  }
}

function verifyWxssCompatibility() {
  const wxssFiles = listTextFiles(miniappRoot).filter((path) => path.endsWith(".wxss"));
  const unsupportedPatterns = [
    [/:root\b/, 'Use "page" instead of ":root" for miniapp WXSS custom properties.'],
    [/\bwidth\s*:\s*fit-content\b/, 'Avoid "width: fit-content"; use intrinsic inline/flex sizing.'],
    [/\bmix-blend-mode\s*:/, 'Avoid "mix-blend-mode"; it is not reliable in native miniapp WXSS.'],
    [/@supports\b/, 'Avoid "@supports"; it is not part of the safe native WXSS subset.'],
    [/@layer\b/, 'Avoid "@layer"; it is not part of the safe native WXSS subset.'],
    [/:has\s*\(/, 'Avoid ":has(...)"; it is not part of the safe native WXSS subset.'],
  ];
  const pageComponentTagSelector =
    /(^|[\s>+~,])(?:view|text|image|button|input|textarea|swiper|swiper-item|scroll-view)(?=$|[\s.#:[>+~,])/;

  for (const filePath of wxssFiles) {
    const text = readFileSync(filePath, "utf8");
    const relativePath = toRepoPath(filePath);

    for (const [pattern, message] of unsupportedPatterns) {
      const match = pattern.exec(text);
      if (match) {
        failures.push(`${relativePath}:${lineForIndex(text, match.index)}: ${message}`);
      }
    }

    if (!relativePath.startsWith("apps/miniapp/pages/")) {
      continue;
    }

    for (const block of text.matchAll(/([^{}]+)\{/g)) {
      const selector = block[1].trim();
      const match = pageComponentTagSelector.exec(selector);
      if (match) {
        failures.push(
          `${relativePath}:${lineForIndex(text, block.index)}: Page WXSS must use class selectors instead of native tag selector "${match[0].trim()}".`,
        );
      }
      if (selector.includes("~")) {
        failures.push(
          `${relativePath}:${lineForIndex(text, block.index)}: Page WXSS must avoid the "~" sibling combinator; wcsc rejects it in native miniapp styles.`,
        );
      }
    }
  }
}

function visitImports(sourceFile, onImport) {
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      onImport({
        sourceFile: sourceFile.fileName,
        specifier: node.moduleSpecifier.text,
        typeOnly: isImportDeclarationTypeOnly(node),
      });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      onImport({
        sourceFile: sourceFile.fileName,
        specifier: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly,
      });
    } else if (ts.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      const isRequire =
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        firstArg &&
        ts.isStringLiteral(firstArg);
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        firstArg &&
        ts.isStringLiteral(firstArg);
      if (isRequire || isDynamicImport) {
        onImport({
          sourceFile: sourceFile.fileName,
          specifier: firstArg.text,
          typeOnly: false,
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function isImportDeclarationTypeOnly(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (!clause.namedBindings) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return false;
  return clause.namedBindings.elements.length > 0
    ? clause.namedBindings.elements.every((element) => element.isTypeOnly)
    : false;
}

function listTextFiles(root) {
  const result = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...listTextFiles(path));
    } else if (/\.(json|ts|wxml|wxss)$/.test(path)) {
      result.push(path);
    }
  }
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toRepoPath(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

function lineForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}
