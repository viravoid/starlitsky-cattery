#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const app = JSON.parse(readFileSync(join(root, "apps/miniapp/app.json"), "utf8"));
const menuCalls = [];
let scene = 1001;
const wx = {
  getEnterOptionsSync: () => ({ scene }),
  showShareMenu: ({ menus }) => menuCalls.push({ enabled: true, menus: [...menus] }),
  hideShareMenu: ({ menus }) => menuCalls.push({ enabled: false, menus: [...menus] }),
  setNavigationBarTitle: () => {},
};
const share = loadModule("utils/native-share.ts", {});
const state = { cat: null, post: null, fixed: null, failed: false };
const publicContent = {
  getPublicCat: async () => result(state.cat),
  getCommunityPost: async () => result(state.post),
  getFixedPage: async () => result(state.fixed),
  listPublicCats: async () => ({ items: [] }),
};
const fixedContent = {
  emptyFixedPageView: (slug) => ({ slug, title: "猫舍介绍", error: "", isLoading: true }),
  normalizeFixedPageView: (slug, title) => ({ slug, title, error: "", isLoading: false }),
  findEnvironmentSection: (_view, id) => id === "环境 & 1" ? {
    id,
    title: "母婴区",
    rooms: [],
  } : null,
};
const imports = {
  "../../utils/native-share": share,
  "../../utils/public-content/index": publicContent,
  "../../utils/fixed-page-content": fixedContent,
  "../../utils/cat-presentation": { resolveCatDetailFrames: () => [], resolveCatFrame: () => null },
  "../../utils/session/auth": { refreshCurrentUser: async () => null },
  "../../store/session/index": { getSessionState: () => ({ roles: [], user: null }) },
  "../../utils/visual-qa/adapter": { configureVisualQaAdapter: () => {} },
};

const publicPages = [
  "home", "cats", "cat-detail", "community", "community-detail", "fixed-page", "environment-detail",
];
const privatePages = [
  "questionnaire", "community-linked", "community-publish", "my-posts", "my-profile",
  "my-cats", "my-cat-detail", "my-cat-edit", "parent-onboard", "parent-auth", "privacy-consent",
];

for (const name of publicPages) {
  assert.ok(app.pages.includes(`pages/${name}/index`), `${name} must be registered`);
  const page = loadPage(name);
  assert.equal(typeof page.onShareAppMessage, "function", `${name} friend callback`);
  assert.equal(typeof page.onShareTimeline, "function", `${name} timeline callback`);
  assert.equal(typeof page.onShow, "function", `${name} show lifecycle`);
  assert.equal(typeof page.onHide, "function", `${name} hide lifecycle`);
  assert.equal(typeof page.onUnload, "function", `${name} unload lifecycle`);
}
for (const name of privatePages) {
  const source = readFileSync(join(root, `apps/miniapp/pages/${name}/index.ts`), "utf8");
  assert.doesNotMatch(source, /onShareAppMessage|onShareTimeline|showShareMenu/, `${name} stays private`);
}

for (const [name, path] of [["home", "/pages/home/index"], ["cats", "/pages/cats/index"], ["community", "/pages/community/index"]]) {
  const page = loadPage(name);
  assert.equal(page.onShareAppMessage().path, path);
  assert.equal(page.onShareTimeline().query, "");
  page.onShow();
  assertMenu(true);
  page.onHide();
  assertMenu(false);
}

assert.equal(share.shareQuery({ id: "中文 & = / %?#" }), "id=%E4%B8%AD%E6%96%87%20%26%20%3D%20%2F%20%25%3F%23");
assert.equal(share.decodeRouteParam("%E7%8C%AB%25"), "猫%");
assert.equal(share.decodeRouteParam("bad%"), "bad%");
assert.equal(share.decodeRouteParam(undefined), "");
scene = 1154;
const menuCount = menuCalls.length;
share.setNativeShareMenu(true);
share.setNativeShareMenu(false);
assert.equal(menuCalls.length, menuCount, "single-page mode must not call restricted menu APIs");
scene = 1001;

const catId = "猫&1=二/%";
state.cat = { id: catId, name: "星月&猫", visibility: "visible", mediaAssets: [],
  kittenProfile: null, breedingProfile: null, gender: null, color: null, birthday: null,
  storyJson: null, personality: null, lifecycleStatus: "breeding" };
let page = loadPage("cat-detail");
let loading = page.onLoad({ id: encodeURIComponent(catId), kind: "studs" });
page.onShow();
await loading;
assertMenu(true);
assert.equal(page.onShareAppMessage().path, `/pages/cat-detail/index?id=${encodeURIComponent(catId)}&kind=studs`);
assert.equal(page.onShareTimeline().query, `id=${encodeURIComponent(catId)}&kind=studs`);
assert.ok(page.onShareAppMessage().title.includes("星月&猫"));
assert.equal(page.onShareAppMessage().imageUrl, undefined);
page.onHide();
assertMenu(false);
page.onShow();
assertMenu(true);
state.cat = { ...state.cat, visibility: "hidden" };
await page.retryLoad();
assertMenu(false);
assert.equal(page.onShareAppMessage().path, "/pages/home/index");
assert.equal(page.onShareAppMessage().imageUrl, "/assets/placeholder-cat.png");
page = loadPage("cat-detail");
await page.onLoad({});
page.onShow();
assertMenu(false);
state.cat = { ...state.cat, visibility: "visible" };
page = loadPage("cat-detail");
loading = page.onLoad({ id: encodeURIComponent(catId), kind: "studs" });
page.onShow();
page.onHide();
await loading;
assertMenu(false);

const postId = "动态&1=%";
state.post = { id: postId, visibility: "visible", content: "中文动态 & 猫咪", mediaAssets: [],
  comments: [], cats: [], litters: [], authorName: "", authorRole: "", category: "parent_share",
  commentCount: 0, likeCount: 0, canEdit: false, canDelete: false, likedByMe: false,
  pinned: false, createdAt: "2026-11-23T00:00:00Z" };
page = loadPage("community-detail");
loading = page.onLoad({ id: encodeURIComponent(postId) });
page.onShow();
await loading;
assertMenu(true);
assert.equal(page.onShareAppMessage().path, `/pages/community-detail/index?id=${encodeURIComponent(postId)}`);
assert.equal(page.onShareTimeline().query, `id=${encodeURIComponent(postId)}`);
state.post = { ...state.post, visibility: "hidden" };
await page.retryLoad();
assertMenu(false);
assert.equal(page.onShareAppMessage().path, "/pages/home/index");
assert.equal(page.onShareTimeline().query, "");
state.failed = true;
await page.retryLoad();
assertMenu(false);
state.failed = false;
page = loadPage("community-detail");
await page.onLoad({});
page.onShow();
assertMenu(false);

state.fixed = { slug: "about", title: "关于星月", status: "published", contentJson: {}, mediaAssets: [] };
page = loadPage("fixed-page");
loading = page.onLoad({ slug: "about" });
page.onShow();
await loading;
assertMenu(true);
assert.equal(page.onShareAppMessage().path, "/pages/fixed-page/index?slug=about");
assert.equal(page.onShareTimeline().query, "slug=about");
state.fixed = { ...state.fixed, status: "draft" };
await page.retryLoad();
assertMenu(false);
state.fixed = { ...state.fixed, status: "hidden" };
await page.retryLoad();
assertMenu(false);
state.fixed = { ...state.fixed, status: "published" };
page = loadPage("fixed-page");
await page.onLoad({});
page.onShow();
assertMenu(false);
assert.equal(page.onShareAppMessage().path, "/pages/home/index");
page = loadPage("fixed-page");
await page.onLoad({ slug: "unknown" });
page.onShow();
assertMenu(false);

state.fixed = { slug: "environment", title: "猫舍环境", status: "published", contentJson: {}, mediaAssets: [] };
page = loadPage("environment-detail");
loading = page.onLoad({ sectionId: encodeURIComponent("环境 & 1") });
page.onShow();
await loading;
assertMenu(true);
assert.equal(page.onShareAppMessage().path, `/pages/environment-detail/index?sectionId=${encodeURIComponent("环境 & 1")}`);
assert.equal(page.onShareTimeline().query, `sectionId=${encodeURIComponent("环境 & 1")}`);
state.fixed = { ...state.fixed, status: "hidden" };
await page.retryLoad();
assertMenu(false);
page = loadPage("environment-detail");
await page.onLoad({});
page.onShow();
assertMenu(false);
page = loadPage("environment-detail");
await page.onLoad({ sectionId: "missing" });
page.onShow();
assertMenu(false);

console.log("Miniapp native share verification passed: 7 public pages, private isolation, routes, encoding, visibility, and lifecycle.");

function result(value) {
  if (state.failed || !value) throw new Error("load failed");
  return value;
}

function assertMenu(enabled) {
  const last = menuCalls.at(-1);
  assert.equal(last?.enabled, enabled);
  assert.deepEqual(last?.menus, ["shareAppMessage", "shareTimeline"]);
}

function loadPage(name) {
  let options;
  loadModule(`pages/${name}/index.ts`, imports, (value) => { options = value; });
  assert.ok(options, `${name} must call Page()`);
  return {
    ...options,
    data: { ...options.data },
    setData(update) { Object.assign(this.data, update); },
  };
}

function loadModule(relativePath, modules, registerPage = () => {}) {
  const filename = join(root, "apps/miniapp", relativePath);
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const sandbox = { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `${relativePath} unexpected import ${name}`);
    return modules[name];
  }, Page: registerPage, wx, console };
  vm.runInNewContext(compiled, sandbox, { filename });
  return exports;
}
