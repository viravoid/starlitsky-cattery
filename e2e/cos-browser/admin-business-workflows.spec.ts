import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  API_ORIGIN,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_LEGACY_MEDIA_ID,
} from "./constants";

test.setTimeout(90_000);

let sharedAdminToken: string | null = null;

async function loginAdmin(page: Page): Promise<string> {
  if (sharedAdminToken) {
    await page.addInitScript(
      (token) => localStorage.setItem("starlitsky.admin.session.token", token),
      sharedAdminToken,
    );
    await page.goto("/");
    await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
    return sharedAdminToken;
  }

  await page.goto("/");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("starlitsky.admin.session.token"));
  expect(token).toBeTruthy();
  sharedAdminToken = token;
  return token!;
}

test("cat profile can be created, edited, hidden and read back from SQLite", async ({
  page,
  request,
}) => {
  const token = await loginAdmin(page);
  expect(token).toBeTruthy();
  const headers = { authorization: `Bearer ${token}` };

  await page.getByRole("link", { name: "其它猫咪" }).click();
  const workspace = page.locator('aside[aria-label="其它猫咪详情"]');
  await workspace.getByRole("button", { name: "新增" }).click();
  await workspace.getByLabel("名字").fill("业务 E2E 测试猫");
  await workspace.getByLabel("性别").selectOption("female");
  await workspace.getByLabel("生日").fill("2024-02-29");
  await workspace.getByLabel("颜色").fill("蓝银虎斑");
  await workspace.getByLabel("生命周期").selectOption("growing");
  await workspace.getByLabel("可见性").selectOption("visible");
  await workspace.getByLabel("性格备注").fill("温柔亲人");
  await workspace.getByLabel("storyJson.detail").fill("测试猫咪故事，保留完整内容。");
  await workspace.getByLabel("storyJson.personality").fill("喜欢互动");
  await workspace.getByLabel("storyJson.diet").fill("主食罐与冻干");
  const createdResponse = page.waitForResponse(
    (response) => response.url() === `${API_ORIGIN}/cats` && response.request().method() === "POST",
  );
  await workspace.getByRole("button", { name: "保存" }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const catId = (await created.json()).data.id as string;
  await expect(page.getByText("猫咪已新增")).toBeVisible();
  expect(readCat(catId)).toMatchObject({
    name: "业务 E2E 测试猫",
    gender: "female",
    color: "蓝银虎斑",
    lifecycle_status: "growing",
    visibility: "visible",
    personality: "温柔亲人",
  });
  expect(JSON.parse(readCat(catId).story_json ?? "null")).toMatchObject({
    detail: "测试猫咪故事，保留完整内容。",
    personality: "喜欢互动",
    diet: "主食罐与冻干",
  });

  await page.reload();
  await page.getByRole("link", { name: "其它猫咪" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 测试猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(workspace.getByLabel("生日")).toHaveValue("2024-02-29");
  await expect(workspace.getByLabel("storyJson.diet")).toHaveValue("主食罐与冻干");
  await workspace.getByLabel("颜色").fill("蓝烟色");
  await workspace.getByLabel("性格备注").fill("");
  await workspace.getByLabel("生命周期").selectOption("retired");
  await workspace.getByLabel("可见性").selectOption("hidden");
  const updatedResponse = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/cats/${catId}` && response.request().method() === "PATCH",
  );
  await workspace.getByRole("button", { name: "保存" }).click();
  expect((await updatedResponse).status()).toBe(200);
  await expect(page.getByText("猫咪资料已更新")).toBeVisible();
  expect(readCat(catId)).toMatchObject({
    color: "蓝烟色",
    lifecycle_status: "retired",
    visibility: "hidden",
    personality: null,
    gender: "female",
  });
  const publicResponse = await request.get(`${API_ORIGIN}/cats/${catId}`);
  expect(publicResponse.status()).toBe(404);
  const adminResponse = await request.get(`${API_ORIGIN}/cats/${catId}`, { headers });
  expect(adminResponse.status()).toBe(200);
  expect((await adminResponse.json()).data.storyJson.diet).toBe("主食罐与冻干");
  await page.reload();
  await page.getByRole("link", { name: "其它猫咪" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 测试猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(workspace.getByLabel("颜色")).toHaveValue("蓝烟色");
  await expect(workspace.getByLabel("可见性")).toHaveValue("hidden");
  await expect(workspace.getByLabel("性格备注")).toHaveValue("");
  await workspace.getByRole("button", { name: "取消" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 测试猫" })
    .getByRole("button", { name: "查看" })
    .click();
  await workspace.getByRole("button", { name: "归档", exact: true }).click();
  await workspace.getByRole("button", { name: "确认归档" }).click();
  await expect(page.getByText("猫咪已归档")).toBeVisible();
  expect(readCat(catId).deleted_at).toBeTruthy();
  await page.reload();
  await page.getByRole("link", { name: "其它猫咪" }).click();
  await page.getByLabel("显示归档").check();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 测试猫" })
    .getByRole("button", { name: "查看" })
    .click();
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await expect(workspace.getByRole("heading", { name: "业务 E2E 测试猫" })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "编辑" })).toHaveCount(0);
  expect((await request.get(`${API_ORIGIN}/cats/${catId}`)).status()).toBe(404);
});

test("breeding cat profile can be created, edited and read back", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("link", { name: "种猫" }).click();
  const editor = page.locator('aside[aria-label="种猫管理详情"]');
  await editor.getByRole("button", { name: "新增" }).click();
  await editor.getByLabel("名字").fill("业务 E2E 种猫");
  await editor.getByLabel("性别").selectOption("female");
  await editor.getByLabel("分类 / 角色").selectOption("queen");
  await editor.getByLabel("繁育状态").selectOption("active");
  await editor.getByLabel("状态文案").fill("现役母猫");
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/cats/with-breeding-profile") &&
      response.request().method() === "POST",
  );
  await editor.getByRole("button", { name: "保存" }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  const catId = (await created.json()).data.id as string;
  await expect(page.getByText("猫咪已新增")).toBeVisible();
  const database = openDatabase();
  try {
    expect(
      database
        .prepare(
          "SELECT breeding_role, reproductive_state, status_label FROM breeding_cat_profiles WHERE cat_id = ?",
        )
        .get(catId),
    ).toMatchObject({
      breeding_role: "queen",
      reproductive_state: "active",
      status_label: "现役母猫",
    });
  } finally {
    database.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "种猫" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 种猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(editor.getByLabel("分类 / 角色")).toHaveValue("queen");
  await editor.getByLabel("繁育状态").selectOption("semiRetired");
  await editor.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("猫咪资料已更新")).toBeVisible();
  const updatedDatabase = openDatabase();
  try {
    expect(
      updatedDatabase
        .prepare(
          "SELECT breeding_role, reproductive_state FROM breeding_cat_profiles WHERE cat_id = ?",
        )
        .get(catId),
    ).toMatchObject({ breeding_role: "queen", reproductive_state: "semiRetired" });
  } finally {
    updatedDatabase.close();
  }
});

test("cat list search, status, visibility and pagination reflect SQLite", async ({
  page,
  request,
}) => {
  const database = openDatabase();
  try {
    const insert = database.prepare(
      "INSERT INTO cats (id, name, gender, color, lifecycle_status, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    database.exec("BEGIN");
    for (let index = 1; index <= 21; index += 1) {
      const hidden = index === 21;
      insert.run(
        `business-e2e-page-cat-${index}`,
        `分页测试猫 ${index}`,
        hidden ? "female" : "male",
        hidden ? "蓝烟" : "蓝银",
        hidden ? "retired" : "growing",
        hidden ? "hidden" : "visible",
        Date.now() + index,
        Date.now() + index,
      );
    }
    database.exec("COMMIT");
  } finally {
    database.close();
  }
  const token = await loginAdmin(page);
  const apiList = await request.get(`${API_ORIGIN}/cats?q=分页测试猫&pageSize=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(apiList.status()).toBe(200);
  expect((await apiList.json()).data.pagination.total).toBe(21);
  await page.getByRole("link", { name: "其它猫咪" }).click();
  const refreshedCats = page.waitForResponse(
    (response) =>
      response.url().startsWith(`${API_ORIGIN}/cats?`) && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "刷新" }).click();
  expect((await (await refreshedCats).json()).data.pagination.total).toBeGreaterThanOrEqual(21);
  await page.getByLabel("搜索猫咪").fill("分页测试猫");
  await expect(page.getByText("共 21 只 · 第 1 / 2 页")).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("共 21 只 · 第 2 / 2 页")).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await page.getByLabel("状态筛选").selectOption("retired");
  await expect(page.getByText("共 1 只 · 第 1 / 1 页")).toBeVisible();
  await expect(page.locator("table tbody tr")).toContainText("分页测试猫 21");
  await page.getByLabel("可见性筛选").selectOption("visible");
  await expect(page.getByText("共 0 只 · 第 1 / 1 页")).toBeVisible();
  await page.getByLabel("可见性筛选").selectOption("hidden");
  await expect(page.locator("table tbody tr")).toContainText("分页测试猫 21");
  await page.reload();
  await page.getByRole("link", { name: "其它猫咪" }).click();
  await page.getByLabel("搜索猫咪").fill("分页测试猫 21");
  await expect(page.locator("table tbody tr")).toContainText("分页测试猫 21");
});

test("litter and kitten relationship survives edits and refresh", async ({ page, request }) => {
  const token = await loginAdmin(page);
  const headers = { authorization: `Bearer ${token}` };
  const fatherResponse = await request.post(`${API_ORIGIN}/cats`, {
    headers,
    data: { name: "E2E 父猫", gender: "male" },
  });
  const motherResponse = await request.post(`${API_ORIGIN}/cats`, {
    headers,
    data: { name: "E2E 母猫", gender: "female" },
  });
  expect(fatherResponse.status()).toBe(201);
  expect(motherResponse.status()).toBe(201);
  const fatherId = (await fatherResponse.json()).data.id as string;
  const motherId = (await motherResponse.json()).data.id as string;

  await page.getByRole("link", { name: "窝次" }).click();
  await page.getByRole("button", { name: "刷新" }).click();
  await page
    .locator('aside[aria-label="窝次详情"]')
    .getByRole("button", { name: "新增窝次" })
    .click();
  const editor = page.locator('aside[aria-label="窝次详情"]');
  await editor.getByLabel("窝次名称").fill("业务 E2E 窝次");
  await editor.getByLabel("父亲").selectOption(fatherId);
  await editor.getByLabel("母亲").selectOption(motherId);
  await editor.getByLabel("预产期").fill("2026-12-01");
  await editor.getByLabel("状态").selectOption("planned");
  await editor.getByLabel("可能颜色 JSON 或文本").fill('["蓝银","蓝烟"]');
  await editor.getByRole("textbox", { name: "备注", exact: true }).fill("预产观察");
  const createResponse = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/litters` && response.request().method() === "POST",
  );
  await editor.getByRole("button", { name: "保存" }).dblclick();
  const created = await createResponse;
  expect(created.status()).toBe(201);
  const litterId = (await created.json()).data.id as string;
  await expect(page.getByText("窝次已新增")).toBeVisible();
  expect(readRow("litters", litterId)).toMatchObject({
    name: "业务 E2E 窝次",
    father_cat_id: fatherId,
    mother_cat_id: motherId,
    status: "planned",
  });
  const duplicateDb = openDatabase();
  try {
    expect(
      (
        duplicateDb
          .prepare("SELECT COUNT(*) AS count FROM litters WHERE name = ?")
          .get("业务 E2E 窝次") as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    duplicateDb.close();
  }

  await editor.getByLabel("出生日期").fill("2026-12-03");
  await editor.getByLabel("状态").selectOption("born");
  await editor.getByRole("textbox", { name: "备注", exact: true }).fill("已出生，状态稳定");
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/litters/${litterId}` &&
      response.request().method() === "PATCH",
  );
  await editor.getByRole("button", { name: "保存" }).click();
  expect((await updateResponse).status()).toBe(200);
  await expect(page.getByText("窝次资料已更新")).toBeVisible();
  expect(readRow("litters", litterId)).toMatchObject({
    father_cat_id: fatherId,
    mother_cat_id: motherId,
    status: "born",
    note: "已出生，状态稳定",
  });
  const invalidParent = await request.patch(`${API_ORIGIN}/litters/${litterId}`, {
    headers,
    data: { fatherCatId: "missing-e2e-cat" },
  });
  expect(invalidParent.status()).toBe(400);
  expect(readRow("litters", litterId).father_cat_id).toBe(fatherId);

  await page.getByRole("link", { name: "小猫", exact: true }).click();
  await page
    .locator('aside[aria-label="小猫管理详情"]')
    .getByRole("button", { name: "新增" })
    .click();
  const kittenEditor = page.locator('aside[aria-label="小猫管理详情"]');
  await kittenEditor.getByLabel("名字").fill("业务 E2E 小猫");
  await kittenEditor.getByLabel("性别").selectOption("male");
  await kittenEditor.getByLabel("所属窝次").selectOption(litterId);
  await kittenEditor.getByLabel("找家状态").selectOption("available");
  const kittenResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/cats/with-kitten-profile") &&
      response.request().method() === "POST",
  );
  await kittenEditor.getByRole("button", { name: "保存" }).click();
  const kittenCreated = await kittenResponse;
  expect(kittenCreated.status()).toBe(201);
  const kittenId = (await kittenCreated.json()).data.id as string;
  await expect(page.getByText("猫咪已新增")).toBeVisible();
  const database = openDatabase();
  try {
    expect(
      database
        .prepare("SELECT litter_id, sale_status FROM kitten_profiles WHERE cat_id = ?")
        .get(kittenId),
    ).toMatchObject({ litter_id: litterId, sale_status: "available" });
  } finally {
    database.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "小猫", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 小猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await kittenEditor.getByLabel("找家状态").selectOption("reserved");
  await kittenEditor.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("猫咪资料已更新")).toBeVisible();
  const updatedKittenDatabase = openDatabase();
  try {
    expect(
      updatedKittenDatabase
        .prepare("SELECT litter_id, sale_status FROM kitten_profiles WHERE cat_id = ?")
        .get(kittenId),
    ).toMatchObject({ litter_id: litterId, sale_status: "reserved" });
  } finally {
    updatedKittenDatabase.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "窝次" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 窝次" })
    .getByRole("button", { name: "查看" })
    .click();
  await expect(editor.getByText("业务 E2E 小猫")).toBeVisible();
  await editor.getByRole("button", { name: "编辑" }).click();
  await expect(editor.getByLabel("预产期")).toHaveValue("2026-12-01");
  await expect(editor.getByLabel("出生日期")).toHaveValue("2026-12-03");
  await expect(editor.getByLabel("父亲")).toHaveValue(fatherId);
  await expect(editor.getByLabel("母亲")).toHaveValue(motherId);
  await editor.locator('select:has(option[value="planned"])').selectOption("archived");
  await editor.getByLabel("可见性").selectOption("archived");
  await editor.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("窝次资料已更新")).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "窝次" }).click();
  const archivedRow = page.getByRole("row").filter({ hasText: "业务 E2E 窝次" });
  await expect(archivedRow).toContainText("归档");
  await archivedRow.getByRole("button", { name: "查看" }).click();
  await expect(editor.getByText("业务 E2E 小猫")).toBeVisible();
  expect(readRow("litters", litterId)).toMatchObject({
    status: "archived",
    visibility: "archived",
    father_cat_id: fatherId,
    mother_cat_id: motherId,
  });
});

test("dashboard labels total comments as a statistic", async ({ page, request }) => {
  const token = await loginAdmin(page);
  const response = await request.get(`${API_ORIGIN}/admin/dashboard`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  await page.getByRole("link", { name: "数据概览" }).click();
  await expect(page.getByRole("link", { name: `${data.comments} 评论总数` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待处理事项" })).toBeVisible();
  await expect(page.locator(".dashboard-todos")).not.toContainText("评论总数");
  const database = openDatabase();
  try {
    const total = database
      .prepare("SELECT COUNT(*) AS total FROM comments WHERE deleted_at IS NULL")
      .get() as { total: number };
    expect(data.comments).toBe(total.total);
  } finally {
    database.close();
  }
});

test("submitted questionnaire can be reviewed in Admin and keeps full answers", async ({
  page,
  request,
}) => {
  const longAnswer = "测试长文本与特殊字符 <>&\"'：" + "猫咪生活习惯。".repeat(42);
  const submission = {
    clientDedupKey: "business-e2e-questionnaire",
    name: "业务 E2E 申请人",
    gender: "female",
    phone: "13800000000",
    age: "30",
    job: "设计师",
    city: "上海",
    experience: "experienced",
    residents: "yes",
    residentsNeutered: "yes",
    hasKids: "no",
    housing: "owned",
    windowSealed: "yes",
    familyAgree: "yes",
    maineCoonKnowledge: longAnswer,
    wantGender: "any",
    wantColor: "蓝银",
    budget: "ready",
    acceptNeuter: "yes",
    monthlySpend: "ready",
    scientificFeeding: "yes",
    acceptActive: "yes",
    commitment: "yes",
    additionalNote: longAnswer,
  };
  const first = await request.post(`${API_ORIGIN}/selection-applications`, { data: submission });
  const replay = await request.post(`${API_ORIGIN}/selection-applications`, { data: submission });
  expect(first.status()).toBe(201);
  expect(replay.status()).toBe(201);
  const applicationId = (await first.json()).data.id as string;
  expect((await replay.json()).data.id).toBe(applicationId);

  const adminToken = await loginAdmin(page);
  await page.getByRole("link", { name: "问卷提交" }).click();
  const panel = page.locator('aside[aria-label="问卷详情"]');
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 申请人" })
    .getByRole("button", { name: "查看" })
    .click();
  await expect(panel.getByText(longAnswer)).toHaveCount(2);
  await panel.getByLabel("管理员备注").fill("已电话核对，可继续沟通");
  const reviewResponse = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/selection-applications/${applicationId}` &&
      response.request().method() === "PATCH",
  );
  await panel.getByRole("button", { name: "已审核" }).click();
  expect((await reviewResponse).status()).toBe(200);
  await expect(page.getByText("问卷已标记为已审核")).toBeVisible();
  const denied = await request.patch(`${API_ORIGIN}/selection-applications/${applicationId}`, {
    data: { status: "completed" },
  });
  expect(denied.status()).toBe(401);
  const database = openDatabase();
  try {
    const row = database
      .prepare(
        "SELECT status, admin_note, reviewed_by, reviewed_at, additional_note FROM selection_applications WHERE id = ?",
      )
      .get(applicationId) as Record<string, string>;
    expect(row).toMatchObject({
      status: "reviewed",
      admin_note: "已电话核对，可继续沟通",
      additional_note: longAnswer,
    });
    expect(row.reviewed_by).toBeTruthy();
    expect(row.reviewed_at).toBeTruthy();
  } finally {
    database.close();
  }
  await expect(panel.getByRole("button", { name: "已审核" })).toBeDisabled();
  const repeatReview = await request.patch(
    `${API_ORIGIN}/selection-applications/${applicationId}`,
    {
      headers: { authorization: `Bearer ${adminToken}` },
      data: { status: "reviewed", adminNote: "已电话核对，可继续沟通" },
    },
  );
  expect(repeatReview.status()).toBe(200);
  const repeatDb = openDatabase();
  try {
    expect(
      (
        repeatDb
          .prepare("SELECT COUNT(*) AS count FROM selection_applications WHERE id = ?")
          .get(applicationId) as { count: number }
      ).count,
    ).toBe(1);
    expect(
      repeatDb
        .prepare("SELECT status, admin_note FROM selection_applications WHERE id = ?")
        .get(applicationId),
    ).toMatchObject({ status: "reviewed", admin_note: "已电话核对，可继续沟通" });
  } finally {
    repeatDb.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "问卷提交" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "业务 E2E 申请人" })
    .getByRole("button", { name: "查看" })
    .click();
  await expect(panel.getByLabel("管理员备注")).toHaveValue("已电话核对，可继续沟通");
  await expect(panel.getByText(longAnswer)).toHaveCount(2);

  for (let index = 1; index <= 20; index += 1) {
    const extra = await request.post(`${API_ORIGIN}/selection-applications`, {
      data: {
        ...submission,
        clientDedupKey: `business-e2e-questionnaire-page-${index}`,
        name: `业务 E2E 分页申请 ${index}`,
      },
    });
    expect(extra.status()).toBe(201);
  }
  await page.reload();
  await page.getByRole("link", { name: "问卷提交" }).click();
  await expect(page.getByText("共 21 条 · 第 1 / 2 页")).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("共 21 条 · 第 2 / 2 页")).toBeVisible();
  await page.getByLabel("搜索").fill("业务 E2E 申请人");
  await page.getByRole("button", { name: "筛选" }).click();
  await expect(page.getByText("共 1 条 · 第 1 / 1 页")).toBeVisible();
  await page.getByLabel("状态").selectOption("reviewed");
  await expect(page.getByRole("row").filter({ hasText: "业务 E2E 申请人" })).toBeVisible();
  await page.getByLabel("状态").selectOption("submitted");
  await expect(page.getByText("当前还没有符合条件的问卷。")).toBeVisible();
});

test("community post and comment moderation changes public visibility", async ({
  page,
  request,
}) => {
  const token = await loginAdmin(page);
  const headers = { authorization: `Bearer ${token}` };
  const postResponse = await request.post(`${API_ORIGIN}/community/posts`, {
    headers,
    data: { category: "cattery_daily", content: "业务 E2E 猫舍动态" },
  });
  expect(postResponse.status()).toBe(201);
  const postId = (await postResponse.json()).data.id as string;
  const commentResponse = await request.post(`${API_ORIGIN}/community/posts/${postId}/comments`, {
    headers,
    data: { content: "业务 E2E 评论" },
  });
  expect(commentResponse.status()).toBe(201);
  const commentId = (await commentResponse.json()).data.id as string;

  await page.getByRole("link", { name: "动态管理" }).click();
  const postRow = page.getByRole("row").filter({ hasText: "业务 E2E 猫舍动态" });
  await expect(postRow).toBeVisible();
  await page.getByLabel("搜索").fill("业务 E2E 猫舍动态");
  await page.getByLabel("分类").selectOption("parent_share");
  await expect(postRow).toHaveCount(0);
  await page.getByLabel("分类").selectOption("cattery_daily");
  await expect(postRow).toBeVisible();
  await page.getByLabel("搜索").fill("");
  await postRow.getByRole("button", { name: "置顶", exact: true }).click();
  await expect(page.getByText("动态状态已更新")).toBeVisible();
  await expect.poll(() => readCommunityRow("posts", postId).pinned).toBe(1);
  await postRow.getByRole("button", { name: "隐藏", exact: true }).click();
  await expect.poll(() => readCommunityRow("posts", postId).visibility).toBe("hidden");
  expect((await request.get(`${API_ORIGIN}/community/posts/${postId}`)).status()).toBe(404);
  await page.reload();
  await page.getByRole("link", { name: "动态管理" }).click();
  await expect(postRow.getByRole("button", { name: "恢复显示" })).toBeVisible();
  await postRow.getByRole("button", { name: "恢复显示" }).click();
  await expect.poll(() => readCommunityRow("posts", postId).visibility).toBe("visible");

  await page.getByRole("link", { name: "评论管理" }).click();
  const commentRow = page.getByRole("row").filter({ hasText: "业务 E2E 评论" });
  await page.getByLabel("搜索").fill("业务 E2E 评论");
  await expect(commentRow).toContainText("业务 E2E 猫舍动态");
  await commentRow.getByRole("button", { name: "隐藏" }).click();
  await expect(page.getByText("评论状态已更新")).toBeVisible();
  await expect.poll(() => readCommunityRow("comments", commentId).visibility).toBe("hidden");
  await page.reload();
  await page.getByRole("link", { name: "评论管理" }).click();
  await expect(commentRow.getByRole("button", { name: "恢复" })).toBeVisible();
  await commentRow.getByRole("button", { name: "恢复" }).click();
  await expect.poll(() => readCommunityRow("comments", commentId).visibility).toBe("visible");

  await page.getByLabel("搜索").fill("");
  await page.getByRole("link", { name: "动态管理" }).click();
  await postRow.getByRole("button", { name: "删除" }).click();
  await expect.poll(() => readCommunityRow("posts", postId).deleted_at).toBeTruthy();
  expect((await request.get(`${API_ORIGIN}/community/posts/${postId}`)).status()).toBe(404);
  await page.getByLabel("显示已删除").check();
  await expect(postRow.getByRole("button", { name: "恢复", exact: true })).toBeVisible();
  await postRow.getByRole("button", { name: "恢复", exact: true }).click();
  await expect.poll(() => readCommunityRow("posts", postId).deleted_at).toBeNull();
  expect((await request.get(`${API_ORIGIN}/community/posts/${postId}`)).status()).toBe(200);

  for (let index = 1; index <= 20; index += 1) {
    const extraPost = await request.post(`${API_ORIGIN}/community/posts`, {
      headers,
      data: { category: "cattery_daily", content: `业务 E2E 分页动态 ${index}` },
    });
    expect(extraPost.status()).toBe(201);
  }
  await page.reload();
  await page.getByRole("link", { name: "动态管理" }).click();
  await expect(page.getByText("共 21 条 · 第 1 / 2 页")).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("共 21 条 · 第 2 / 2 页")).toBeVisible();
});

test("community moderation failure and expired session do not change a post", async ({
  page,
  request,
}) => {
  const token = await loginAdmin(page);
  const created = await request.post(`${API_ORIGIN}/community/posts`, {
    headers: { authorization: `Bearer ${token}` },
    data: { category: "cattery_daily", content: "业务 E2E 失败验证动态" },
  });
  expect(created.status()).toBe(201);
  const postId = (await created.json()).data.id as string;
  await page.reload();
  await page.getByRole("link", { name: "动态管理" }).click();
  await page.getByLabel("搜索").fill("业务 E2E 失败验证动态");
  const postRow = page.getByRole("row").filter({ hasText: "业务 E2E 失败验证动态" });
  await expect(postRow).toBeVisible();

  const patchUrl = `${API_ORIGIN}/community/admin/posts/${postId}`;
  await page.route(patchUrl, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "隔离测试模拟服务故障" }),
    }),
  );
  await postRow.getByRole("button", { name: "隐藏", exact: true }).click();
  await expect(page.locator(".error-banner")).toBeVisible();
  expect(readCommunityRow("posts", postId).visibility).toBe("visible");
  await page.unroute(patchUrl);

  await page.evaluate(() =>
    localStorage.setItem("starlitsky.admin.session.token", "expired-e2e-token"),
  );
  const unauthorized = page.waitForResponse(
    (response) => response.url() === patchUrl && response.request().method() === "PATCH",
  );
  await postRow.getByRole("button", { name: "隐藏", exact: true }).click();
  expect((await unauthorized).status()).toBe(401);
  expect(readCommunityRow("posts", postId).visibility).toBe("visible");

  await page.evaluate(
    (validToken) => localStorage.setItem("starlitsky.admin.session.token", validToken),
    token,
  );
  await page.reload();
  await page.getByRole("link", { name: "动态管理" }).click();
  await page.getByLabel("搜索").fill("业务 E2E 失败验证动态");
  await expect(postRow.getByRole("button", { name: "隐藏", exact: true })).toBeVisible();
});

test("admin directly certifies, disables and restores a parent with a hidden cat", async ({
  page,
  request,
}) => {
  const userId = "business-e2e-parent-user";
  const catId = "business-e2e-parent-hidden-cat";
  const secondCatId = "business-e2e-parent-second-cat";
  const userToken = "business-e2e-parent-session";
  const now = Date.now();
  const database = openDatabase();
  try {
    database
      .prepare(
        "INSERT INTO users (id, wechat_openid, nickname, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(userId, "business-e2e-openid", "业务 E2E 用户", "active", now, now);
    database
      .prepare("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?, ?, ?, ?)")
      .run("business-e2e-user-role", userId, "user", now);
    database
      .prepare(
        "INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        "business-e2e-parent-session-id",
        userId,
        createHash("sha256")
          .update(`local-cos-e2e-auth-token-secret-32-characters:${userToken}`)
          .digest("hex"),
        now + 3_600_000,
        now,
        now,
      );
    database
      .prepare(
        "INSERT INTO cats (id, name, lifecycle_status, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(catId, "业务 E2E 隐藏猫", "growing", "hidden", now, now);
    database
      .prepare(
        "INSERT INTO cats (id, name, lifecycle_status, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(secondCatId, "业务 E2E 第二只猫", "growing", "visible", now, now);
  } finally {
    database.close();
  }
  const userHeaders = { authorization: `Bearer ${userToken}` };
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: userHeaders })).status()).toBe(403);
  await loginAdmin(page);
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/admin/users?") &&
      response.url().includes(`q=${userId}`) &&
      response.ok(),
    ),
    page.getByPlaceholder("user id / 昵称 / 手机 / 家长姓名").fill(userId),
  ]);
  await expect(page.getByText("加载中...")).toBeHidden();
  await page.getByRole("row").filter({ hasText: userId }).click();
  const detail = page.locator("aside.detail-panel");
  await expect(detail.getByRole("heading", { name: "直接认证为家长" })).toBeVisible();
  await detail.getByLabel("手机").fill("13900000000");
  await detail.getByLabel("搜索猫咪档案（包含隐藏档案）").fill("业务 E2E 隐藏猫");
  await detail.getByRole("button", { name: "查询猫咪" }).click();
  await detail.getByLabel("选择猫咪").selectOption(catId);
  await detail.getByRole("button", { name: "加入待认证关系" }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await detail.getByRole("button", { name: "确认认证为家长" }).click();
  await expect(page.getByText("已认证为家长，并复用原 users.id")).toBeVisible();
  const dbAfterCertify = openDatabase();
  try {
    expect(
      dbAfterCertify
        .prepare(
          "SELECT status, contact_phone, contact_phone_source FROM parent_profiles WHERE user_id = ?",
        )
        .get(userId),
    ).toMatchObject({
      status: "active",
      contact_phone: "13900000000",
      contact_phone_source: "admin_entered",
    });
    expect(
      (
        dbAfterCertify
          .prepare(
            "SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ? AND role = 'parent' AND revoked_at IS NULL",
          )
          .get(userId) as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        dbAfterCertify
          .prepare(
            "SELECT COUNT(*) AS count FROM parent_cat_links WHERE cat_id = ? AND status = 'active' AND deleted_at IS NULL",
          )
          .get(catId) as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    dbAfterCertify.close();
  }
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: userHeaders })).status()).toBe(200);
  await detail.getByRole("button", { name: "停用家长身份" }).click();
  await expect(page.getByText("家长身份已停用", { exact: true })).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: userHeaders })).status()).toBe(403);
  await page.reload();
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await page.getByPlaceholder("user id / 昵称 / 手机 / 家长姓名").fill(userId);
  await detail.getByRole("button", { name: "重新启用家长" }).click();
  await expect(page.getByText("家长身份已恢复")).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: userHeaders })).status()).toBe(200);
  const dbAfterRestore = openDatabase();
  try {
    expect(
      (
        dbAfterRestore
          .prepare(
            "SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ? AND role = 'parent' AND revoked_at IS NULL",
          )
          .get(userId) as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        dbAfterRestore
          .prepare(
            "SELECT COUNT(*) AS count FROM parent_cat_links WHERE cat_id = ? AND status = 'active' AND deleted_at IS NULL",
          )
          .get(catId) as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    dbAfterRestore.close();
  }

  await detail.getByLabel("搜索猫咪档案（包含隐藏档案）").fill("业务 E2E 第二只猫");
  await detail.getByRole("button", { name: "查询猫咪" }).click();
  await detail.getByLabel("新增猫咪").selectOption(secondCatId);
  await detail.getByRole("button", { name: "添加绑定" }).click();
  await expect(page.getByText("猫咪关联已创建", { exact: true })).toBeVisible();
  const secondLink = detail.locator(".parent-link-row").filter({ hasText: "业务 E2E 第二只猫" });
  await expect(secondLink).toBeVisible();
  const relationshipUpdate = page.waitForResponse(
    (response) =>
      response.url().includes("/parent-cat-links/") && response.request().method() === "PATCH",
  );
  await secondLink.locator("select").first().selectOption("caregiver");
  expect((await relationshipUpdate).status()).toBe(200);
  await expect(page.getByText("猫咪关联已更新", { exact: true })).toBeVisible();
  const caregiverLink = secondLink.filter({
    has: page.locator('option[value="caregiver"]:checked'),
  });
  await expect(caregiverLink).toHaveCount(1);
  const statusUpdate = page.waitForResponse(
    (response) =>
      response.url().includes("/parent-cat-links/") && response.request().method() === "PATCH",
  );
  await caregiverLink.locator("select").nth(1).selectOption("ended");
  expect((await statusUpdate).status()).toBe(200);
  await expect(page.getByText("猫咪关联已更新", { exact: true })).toBeVisible();
  const linkDatabase = openDatabase();
  try {
    const history = linkDatabase
      .prepare(
        "SELECT relationship, status, ended_at, deleted_at FROM parent_cat_links WHERE cat_id = ?",
      )
      .all(secondCatId) as Array<{
      relationship: string;
      status: string;
      ended_at: number | null;
      deleted_at: number | null;
    }>;
    expect(history).toHaveLength(2);
    expect(history.map((link) => `${link.relationship}:${link.status}`).sort()).toEqual([
      "caregiver:ended",
      "owner:ended",
    ]);
    expect(history.every((link) => link.ended_at !== null && link.deleted_at === null)).toBe(true);
  } finally {
    linkDatabase.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await page.getByPlaceholder("user id / 昵称 / 手机 / 家长姓名").fill(userId);
  await expect(secondLink).toHaveCount(2);
  await expect(secondLink.locator("select").nth(1)).toHaveValue("ended");
  await expect(secondLink.locator("select").nth(3)).toHaveValue("ended");

  const verifiedFixtureDb = openDatabase();
  try {
    verifiedFixtureDb
      .prepare(
        "UPDATE parent_profiles SET contact_phone_source = 'wechat_verified', contact_phone_verified_at = ? WHERE user_id = ?",
      )
      .run(Date.now(), userId);
  } finally {
    verifiedFixtureDb.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await page.getByPlaceholder("user id / 昵称 / 手机 / 家长姓名").fill(userId);
  await expect(detail.getByText("微信验证", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "保存家长资料与关系" }).click();
  await expect(page.getByText("已认证为家长，并复用原 users.id")).toBeVisible();
  const unchangedPhoneDb = openDatabase();
  try {
    expect(
      unchangedPhoneDb
        .prepare("SELECT contact_phone_source FROM parent_profiles WHERE user_id = ?")
        .get(userId),
    ).toMatchObject({ contact_phone_source: "wechat_verified" });
  } finally {
    unchangedPhoneDb.close();
  }
  await detail.getByLabel("手机").fill("13900000001");
  await detail.getByRole("button", { name: "保存家长资料与关系" }).click();
  await expect(detail.getByText("管理员录入 / 未经微信验证", { exact: true })).toBeVisible();
  const changedPhoneDb = openDatabase();
  try {
    expect(
      changedPhoneDb
        .prepare(
          "SELECT contact_phone_source, contact_phone_verified_at FROM parent_profiles WHERE user_id = ?",
        )
        .get(userId),
    ).toMatchObject({ contact_phone_source: "admin_entered", contact_phone_verified_at: null });
    changedPhoneDb
      .prepare("UPDATE parent_profiles SET contact_phone_source = 'unknown' WHERE user_id = ?")
      .run(userId);
  } finally {
    changedPhoneDb.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await page.getByPlaceholder("user id / 昵称 / 手机 / 家长姓名").fill(userId);
  await expect(detail.getByText("历史来源未知", { exact: true })).toBeVisible();
});

test("self submitted parent applications are approved or rejected through Admin", async ({
  page,
  request,
}) => {
  const now = Date.now();
  const db = openDatabase();
  try {
    for (const suffix of ["approved", "rejected"]) {
      const userId = `business-e2e-${suffix}-applicant`;
      const catId = `business-e2e-${suffix}-cat`;
      const userToken = `business-e2e-${suffix}-token`;
      db.prepare(
        "INSERT INTO users (id, wechat_openid, nickname, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(userId, `business-e2e-${suffix}-openid`, `业务 E2E ${suffix}用户`, "active", now, now);
      db.prepare("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?, ?, ?, ?)").run(
        `business-e2e-${suffix}-role`,
        userId,
        "user",
        now,
      );
      db.prepare(
        "INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        `business-e2e-${suffix}-session`,
        userId,
        createHash("sha256")
          .update(`local-cos-e2e-auth-token-secret-32-characters:${userToken}`)
          .digest("hex"),
        now + 3_600_000,
        now,
        now,
      );
      db.prepare(
        "INSERT INTO cats (id, name, lifecycle_status, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(catId, `业务 E2E ${suffix}猫`, "growing", "visible", now, now);
    }
  } finally {
    db.close();
  }
  const approvedHeaders = { authorization: "Bearer business-e2e-approved-token" };
  const rejectedHeaders = { authorization: "Bearer business-e2e-rejected-token" };
  const approvedSubmit = await request.post(`${API_ORIGIN}/parent-applications`, {
    headers: approvedHeaders,
    data: {
      displayName: "业务 E2E 通过申请",
      gender: "female",
      contactPhone: "13800000001",
      existingCatClaims: [{ catId: "business-e2e-approved-cat" }],
    },
  });
  const rejectedSubmit = await request.post(`${API_ORIGIN}/parent-applications`, {
    headers: rejectedHeaders,
    data: {
      displayName: "业务 E2E 拒绝申请",
      gender: "male",
      contactPhone: "13800000002",
      existingCatClaims: [{ catId: "business-e2e-rejected-cat" }],
    },
  });
  expect(approvedSubmit.status()).toBe(201);
  expect(rejectedSubmit.status()).toBe(201);
  const approvedId = (await approvedSubmit.json()).data.id as string;
  const rejectedId = (await rejectedSubmit.json()).data.id as string;
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: approvedHeaders })).status()).toBe(
    403,
  );
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: rejectedHeaders })).status()).toBe(
    403,
  );
  await loginAdmin(page);
  await page.getByRole("link", { name: "家长申请审核" }).click();
  const detail = page.locator("aside.detail-panel");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("row").filter({ hasText: "业务 E2E approved用户" }).click();
  await expect(detail.getByRole("heading", { name: "业务 E2E 通过申请" })).toBeVisible();
  await expect(detail.getByText("自行填写的手机号", { exact: true })).toBeVisible();
  await detail.getByLabel("管理员备注").fill("测试通过");
  await detail.getByRole("button", { name: "通过", exact: true }).click();
  await expect(page.getByText("申请已通过", { exact: true })).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: approvedHeaders })).status()).toBe(
    200,
  );
  await page.getByRole("row").filter({ hasText: "业务 E2E rejected用户" }).click();
  await expect(detail.getByRole("heading", { name: "业务 E2E 拒绝申请" })).toBeVisible();
  await detail.getByLabel("管理员备注").fill("测试拒绝");
  await detail.getByRole("button", { name: "拒绝", exact: true }).click();
  await expect(page.getByText("申请已拒绝", { exact: true })).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: rejectedHeaders })).status()).toBe(
    403,
  );
  const finalDb = openDatabase();
  try {
    expect(
      finalDb
        .prepare(
          "SELECT status, admin_note, reviewed_at, reviewed_by FROM parent_applications WHERE id = ?",
        )
        .get(approvedId),
    ).toMatchObject({ status: "approved", admin_note: "测试通过" });
    expect(
      finalDb
        .prepare(
          "SELECT status, admin_note, reviewed_at, reviewed_by FROM parent_applications WHERE id = ?",
        )
        .get(rejectedId),
    ).toMatchObject({ status: "rejected", admin_note: "测试拒绝" });
    expect(
      (
        finalDb
          .prepare(
            "SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ? AND role = 'parent' AND revoked_at IS NULL",
          )
          .get("business-e2e-approved-applicant") as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        finalDb
          .prepare(
            "SELECT COUNT(*) AS count FROM user_roles WHERE user_id = ? AND role = 'parent' AND revoked_at IS NULL",
          )
          .get("business-e2e-rejected-applicant") as { count: number }
      ).count,
    ).toBe(0);
  } finally {
    finalDb.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "家长申请审核" }).click();
  await page.getByRole("row").filter({ hasText: "业务 E2E approved用户" }).click();
  await expect(detail.getByLabel("管理员备注")).toHaveValue("测试通过");
  await page.getByRole("link", { name: "用户 / 家长管理" }).click();
  await page
    .getByPlaceholder("user id / 昵称 / 手机 / 家长姓名")
    .fill("business-e2e-approved-applicant");
  await page.locator("aside.detail-panel").getByRole("button", { name: "停用家长身份" }).click();
  await expect(page.getByText("家长身份已停用", { exact: true })).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: approvedHeaders })).status()).toBe(
    403,
  );
  const historyDb = openDatabase();
  try {
    historyDb
      .prepare("UPDATE parent_applications SET created_at = ? WHERE id = ?")
      .run(Date.now() - 2 * 60 * 60 * 1000, approvedId);
  } finally {
    historyDb.close();
  }
  const reapplication = await request.post(`${API_ORIGIN}/parent-applications`, {
    headers: approvedHeaders,
    data: {
      displayName: "业务 E2E 再申请",
      gender: "female",
      contactPhone: "13800000001",
      existingCatClaims: [{ catId: "business-e2e-approved-cat" }],
    },
  });
  expect(reapplication.status()).toBe(201);
  const reapplicationId = (await reapplication.json()).data.id as string;
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: approvedHeaders })).status()).toBe(
    403,
  );
  await page.getByRole("link", { name: "家长申请审核" }).click();
  await page.getByRole("row").filter({ hasText: "业务 E2E approved用户" }).first().click();
  await expect(detail.getByRole("heading", { name: "业务 E2E 再申请" })).toBeVisible();
  await detail.getByRole("button", { name: "通过", exact: true }).click();
  await expect(page.getByText("申请已通过", { exact: true })).toBeVisible();
  expect((await request.get(`${API_ORIGIN}/me/cats`, { headers: approvedHeaders })).status()).toBe(
    200,
  );
  const restoredDb = openDatabase();
  try {
    expect(
      restoredDb
        .prepare("SELECT status FROM parent_applications WHERE id = ?")
        .get(reapplicationId),
    ).toMatchObject({ status: "approved" });
    expect(
      (
        restoredDb
          .prepare("SELECT COUNT(*) AS count FROM parent_profiles WHERE user_id = ?")
          .get("business-e2e-approved-applicant") as { count: number }
      ).count,
    ).toBe(1);
    expect(
      (
        restoredDb
          .prepare(
            "SELECT COUNT(*) AS count FROM parent_cat_links WHERE cat_id = ? AND status = 'active' AND deleted_at IS NULL",
          )
          .get("business-e2e-approved-cat") as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    restoredDb.close();
  }
});

test("new cat approval requires explicit confirmation and repeat approval does not duplicate", async ({
  page,
  request,
}) => {
  const userId = "business-e2e-new-cat-applicant";
  const userToken = "business-e2e-new-cat-token";
  const catName = "业务 E2E 确认新猫";
  const now = Date.now();
  const db = openDatabase();
  try {
    db.prepare(
      "INSERT INTO users (id, wechat_openid, nickname, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(userId, "business-e2e-new-cat-openid", "业务 E2E 新猫申请人", "active", now, now);
    db.prepare("INSERT INTO user_roles (id, user_id, role, granted_at) VALUES (?, ?, ?, ?)").run(
      "business-e2e-new-cat-role",
      userId,
      "user",
      now,
    );
    db.prepare(
      "INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      "business-e2e-new-cat-session",
      userId,
      createHash("sha256")
        .update(`local-cos-e2e-auth-token-secret-32-characters:${userToken}`)
        .digest("hex"),
      now + 3_600_000,
      now,
      now,
    );
  } finally {
    db.close();
  }

  const missingPhone = await request.post(`${API_ORIGIN}/parent-applications`, {
    headers: { authorization: `Bearer ${userToken}` },
    data: { displayName: "业务 E2E 新猫申请", newCats: [{ name: catName }] },
  });
  expect(missingPhone.status()).toBe(400);
  const submission = await request.post(`${API_ORIGIN}/parent-applications`, {
    headers: { authorization: `Bearer ${userToken}` },
    data: {
      displayName: "业务 E2E 新猫申请",
      contactPhone: "13800000003",
      newCats: [{ name: catName, gender: "female", color: "蓝银", relationship: "owner" }],
    },
  });
  expect(submission.status()).toBe(201);
  const applicationId = (await submission.json()).data.id as string;
  const adminToken = await loginAdmin(page);
  await page.getByRole("link", { name: "家长申请审核" }).click();
  await page.getByRole("row").filter({ hasText: "业务 E2E 新猫申请人" }).click();
  const detail = page.locator("aside.detail-panel");
  await expect(detail.getByRole("heading", { name: "业务 E2E 新猫申请" })).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await detail.getByRole("button", { name: "通过", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText("请逐条确认");
  expect(countNamedCats(catName)).toBe(0);
  await detail.getByLabel("确认尚无档案并新建").check();
  await detail.getByRole("button", { name: "通过", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText("请逐条确认");
  expect(countNamedCats(catName)).toBe(0);
  await detail.getByLabel(`已核查现有档案，确认“${catName}”确实尚无档案并新建`).check();
  const approval = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/parent-applications/${applicationId}/approve` &&
      response.request().method() === "POST",
  );
  await detail.getByRole("button", { name: "通过", exact: true }).click();
  expect((await approval).status()).toBe(200);
  await expect(page.getByText("申请已通过", { exact: true })).toBeVisible();
  expect(countNamedCats(catName)).toBe(1);
  const repeat = await request.post(`${API_ORIGIN}/parent-applications/${applicationId}/approve`, {
    headers: { authorization: `Bearer ${adminToken}` },
    data: {},
  });
  expect(repeat.status()).toBe(200);
  expect(countNamedCats(catName)).toBe(1);
  const finalDb = openDatabase();
  try {
    const cat = finalDb.prepare("SELECT id, visibility FROM cats WHERE name = ?").get(catName) as {
      id: string;
      visibility: string;
    };
    expect(cat.visibility).toBe("hidden");
    expect(
      (
        finalDb
          .prepare(
            "SELECT COUNT(*) AS count FROM parent_cat_links WHERE cat_id = ? AND status = 'active' AND deleted_at IS NULL",
          )
          .get(cat.id) as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    finalDb.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "家长申请审核" }).click();
  await page.getByRole("row").filter({ hasText: "业务 E2E 新猫申请人" }).click();
  await expect(detail.getByRole("button", { name: "通过", exact: true })).toBeDisabled();
});

test("media library finds, previews, binds and unbinds an existing asset", async ({
  page,
  request,
}) => {
  const token = await loginAdmin(page);
  const headers = { authorization: `Bearer ${token}` };
  const catResponse = await request.post(`${API_ORIGIN}/cats`, {
    headers,
    data: { name: "业务 E2E 媒体关联猫" },
  });
  expect(catResponse.status()).toBe(201);
  const catId = (await catResponse.json()).data.id as string;
  await page.reload();
  await page.getByRole("link", { name: "媒体库" }).click();
  await page.getByLabel("搜索媒体").fill("COS E2E legacy private image");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.locator('section[aria-label="媒体列表"] tbody tr')).toHaveCount(1);
  await page.getByLabel("媒体类型").selectOption("image");
  await page.getByLabel("媒体状态").selectOption("active");
  await page
    .locator('section[aria-label="媒体列表"] tbody tr')
    .getByRole("button", { name: "查看" })
    .click();
  const detail = page.locator('aside[aria-label="媒体详情"]');
  await expect(detail.getByRole("img", { name: "isolated legacy private image" })).toBeVisible();
  const bindingForm = detail.locator("form.media-add-binding");
  await bindingForm.getByLabel("关联内容").selectOption(catId);
  const bindingUrl = `${API_ORIGIN}/media/${E2E_LEGACY_MEDIA_ID}/bindings`;
  await page.route(bindingUrl, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "隔离测试模拟绑定失败" }),
    }),
  );
  await bindingForm.getByRole("button", { name: "新增绑定" }).click();
  await expect(page.locator(".error-banner")).toContainText("隔离测试模拟绑定失败");
  const failedDb = openDatabase();
  try {
    expect(
      (
        failedDb
          .prepare(
            "SELECT COUNT(*) AS count FROM media_bindings WHERE media_id = ? AND owner_id = ? AND deleted_at IS NULL",
          )
          .get(E2E_LEGACY_MEDIA_ID, catId) as { count: number }
      ).count,
    ).toBe(0);
  } finally {
    failedDb.close();
  }
  await page.unroute(bindingUrl);
  await bindingForm.getByRole("button", { name: "新增绑定" }).click();
  await expect(page.getByText("已新增真实业务绑定")).toBeVisible();
  const dbAfterBind = openDatabase();
  try {
    expect(
      (
        dbAfterBind
          .prepare(
            "SELECT COUNT(*) AS count FROM media_bindings WHERE media_id = ? AND owner_id = ? AND deleted_at IS NULL",
          )
          .get(E2E_LEGACY_MEDIA_ID, catId) as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    dbAfterBind.close();
  }
  await page.reload();
  await page.getByRole("link", { name: "媒体库" }).click();
  await page.getByLabel("搜索媒体").fill("COS E2E legacy private image");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page
    .locator('section[aria-label="媒体列表"] tbody tr')
    .getByRole("button", { name: "查看" })
    .click();
  const bindingCard = detail
    .locator(".media-binding-card")
    .filter({ hasText: "业务 E2E 媒体关联猫" });
  await expect(bindingCard).toBeVisible();
  await bindingCard.getByRole("button", { name: "移除绑定" }).click();
  await bindingCard.getByRole("button", { name: "确认移除绑定" }).click();
  await expect(page.getByText("绑定已移除；媒体文件和其它内容引用保持不变")).toBeVisible();
  const dbAfterUnbind = openDatabase();
  try {
    expect(
      (
        dbAfterUnbind
          .prepare(
            "SELECT COUNT(*) AS count FROM media_bindings WHERE media_id = ? AND owner_id = ? AND deleted_at IS NULL",
          )
          .get(E2E_LEGACY_MEDIA_ID, catId) as { count: number }
      ).count,
    ).toBe(0);
    expect(
      (
        dbAfterUnbind
          .prepare(
            "SELECT COUNT(*) AS count FROM media_bindings WHERE media_id = ? AND deleted_at IS NULL",
          )
          .get(E2E_LEGACY_MEDIA_ID) as { count: number }
      ).count,
    ).toBe(1);
  } finally {
    dbAfterUnbind.close();
  }
});

function openDatabase() {
  const path = process.env.COS_E2E_DATABASE_PATH;
  if (!path || !path.includes("cos-browser-e2e-"))
    throw new Error("Isolated E2E database path is missing");
  const database = new DatabaseSync(path);
  database.exec("PRAGMA busy_timeout = 5000");
  return database;
}

function countNamedCats(name: string) {
  const database = openDatabase();
  try {
    return (
      database.prepare("SELECT COUNT(*) AS count FROM cats WHERE name = ?").get(name) as {
        count: number;
      }
    ).count;
  } finally {
    database.close();
  }
}

function readCat(id: string) {
  return readRow("cats", id);
}

function readRow(table: "cats" | "litters", id: string) {
  const database = openDatabase();
  try {
    const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    expect(row).toBeTruthy();
    return row as Record<string, string | null>;
  } finally {
    database.close();
  }
}

function readCommunityRow(table: "posts" | "comments", id: string) {
  const database = openDatabase();
  try {
    const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    expect(row).toBeTruthy();
    return row as Record<string, string | number | null>;
  } finally {
    database.close();
  }
}
