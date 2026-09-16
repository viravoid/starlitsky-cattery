#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
    [
      "pages/community/index",
      "猫友圈",
      "assets/tabbar/community.png",
      "assets/tabbar/community-active.png",
    ],
    ["pages/cats/index", "我们的猫", "assets/tabbar/cats.png", "assets/tabbar/cats-active.png"],
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
  const modePath = join(miniappRoot, "utils/visual-qa/mode.ts");
  const fixturePath = join(miniappRoot, "utils/visual-qa/fixtures.ts");
  const publicContentPath = join(miniappRoot, "utils/public-content/index.ts");
  const appPath = join(miniappRoot, "app.ts");
  for (const requiredPath of [modePath, fixturePath]) {
    if (!existsSync(requiredPath)) {
      failures.push(`${relative(repoRoot, requiredPath)} is required for explicit Visual QA fixture mode.`);
    }
  }
  if (!existsSync(modePath) || !existsSync(publicContentPath)) return;

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
  if (!appText.includes("configureVisualQaMode(options?.query)")) {
    failures.push("App launch must configure Visual QA mode from the explicit launch query.");
  }
  if (!publicContentText.includes("isVisualQaModeEnabled()")) {
    failures.push("Public content helpers must gate Visual QA fixtures behind isVisualQaModeEnabled().");
  }
  if (/catch\s*\([^)]*\)\s*\{[^}]*VisualQa/s.test(publicContentText)) {
    failures.push("Visual QA fixtures must not be used as an API failure fallback.");
  }
}

function verifyVisualQaMutationGuards() {
  const requestPath = join(miniappRoot, "utils/request/index.ts");
  const publicContentPath = join(miniappRoot, "utils/public-content/index.ts");
  const fixturePath = join(miniappRoot, "utils/visual-qa/fixtures.ts");
  const publishPath = join(miniappRoot, "pages/community-publish/index.ts");
  if (![requestPath, publicContentPath, fixturePath, publishPath].every(existsSync)) return;

  const requestText = readFileSync(requestPath, "utf8");
  const publicContentText = readFileSync(publicContentPath, "utf8");
  const fixtureText = readFileSync(fixturePath, "utf8");
  const publishText = readFileSync(publishPath, "utf8");

  if (!/method\s*!==\s*"GET"\s*&&\s*isVisualQaModeEnabled\(\)/.test(requestText)) {
    failures.push("Visual QA mode must block non-GET requests in the shared miniapp request wrapper.");
  }
  if (!requestText.includes("VISUAL_QA_MUTATION_BLOCKED")) {
    failures.push("Visual QA mutation blocking must return an explicit VISUAL_QA_MUTATION_BLOCKED error.");
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
    const publicPattern = new RegExp(
      `function\\s+${publicFunction}\\b[\\s\\S]*?isVisualQaModeEnabled\\(\\)[\\s\\S]*?${fixtureFunction}\\(`,
    );
    if (!publicPattern.test(publicContentText)) {
      failures.push(
        `apps/miniapp/utils/public-content/index.ts must route ${publicFunction} to ${fixtureFunction} when visualQa=1.`,
      );
    }
    if (!new RegExp(`function\\s+${fixtureFunction}\\b`).test(fixtureText)) {
      failures.push(`Missing Visual QA fixture mutation helper: ${fixtureFunction}.`);
    }
  }

  if (!/function\s+uploadPostImage\b[\s\S]*?isVisualQaModeEnabled\(\)[\s\S]*?return;/.test(publishText)) {
    failures.push("Community post image upload must skip direct wx.request PUT in Visual QA mode.");
  }
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
