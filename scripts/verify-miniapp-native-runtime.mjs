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
verifyRuntimeImports();

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
