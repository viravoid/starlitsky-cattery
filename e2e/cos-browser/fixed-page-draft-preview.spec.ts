import { expect, test } from "@playwright/test";
import {
  API_ORIGIN,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_LEGACY_MEDIA_ID,
} from "./constants";

test("fixed-page preview shows unsaved edits without publishing and preserves them on return", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("starlitsky.admin.session.token"));
  expect(token).toBeTruthy();
  const headers = { authorization: `Bearer ${token}` };

  const seed = await request.patch(`${API_ORIGIN}/fixed-pages/contact`, {
    headers,
    data: {
      title: "联系方式",
      status: "published",
      contentJson: {
        introduction: "保存前的说明",
        accounts: [{ id: "wechat", label: "微信", value: "example" }],
        footerNotice: "保存前的提示",
      },
    },
  });
  expect(seed.status()).toBe(200);

  await page.getByRole("link", { name: "联系方式" }).click();
  const editor = page.getByRole("complementary", { name: "固定页面编辑" });
  await expect(editor.getByLabel("说明文字")).toHaveValue("保存前的说明");
  await editor.getByLabel("说明文字").fill("尚未保存的说明 A");
  await editor.getByLabel("账号", { exact: true }).fill("draft-account");
  await editor.getByRole("button", { name: "预览未保存内容" }).click();
  const preview = page.getByRole("region", { name: "未保存内容预览" });
  await expect(preview).toContainText("尚未保存的说明 A");
  await expect(preview).toContainText("draft-account");
  let stored = await request.get(`${API_ORIGIN}/fixed-pages/contact`, { headers });
  expect((await stored.json()).data.contentJson.introduction).toBe("保存前的说明");

  await preview.getByRole("button", { name: "返回编辑" }).click();
  await expect(editor.getByLabel("说明文字")).toHaveValue("尚未保存的说明 A");
  await editor.getByLabel("说明文字").fill("尚未保存的说明 B");
  await editor.getByRole("button", { name: "预览未保存内容" }).click();
  await expect(preview).toContainText("尚未保存的说明 B");
  await preview.getByRole("button", { name: "返回编辑" }).click();
  await editor.getByRole("button", { name: "保存更改" }).click();
  await expect(page.getByText("固定页面内容已保存")).toBeVisible();
  stored = await request.get(`${API_ORIGIN}/fixed-pages/contact`, { headers });
  expect((await stored.json()).data.contentJson.introduction).toBe("尚未保存的说明 B");
  await page.reload();
  await expect(editor.getByLabel("说明文字")).toHaveValue("尚未保存的说明 B");

  await editor.getByLabel("说明文字").fill("取消的草稿");
  await editor.getByRole("button", { name: "预览未保存内容" }).click();
  await expect(preview).toContainText("取消的草稿");
  await preview.getByRole("button", { name: "返回编辑" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "取消本次修改" }).click();
  await expect(editor.getByLabel("说明文字")).toHaveValue("尚未保存的说明 B");
  stored = await request.get(`${API_ORIGIN}/fixed-pages/contact`, { headers });
  expect((await stored.json()).data.contentJson.introduction).toBe("尚未保存的说明 B");
});

test("all fixed-page templates open a readable preview without changing public content", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const pages = [
    ["home", "首页"],
    ["about", "猫舍介绍"],
    ["philosophy", "繁育理念"],
    ["environment", "猫舍环境"],
    ["feeding", "喂养体系"],
    ["process", "价格与接猫流程"],
    ["breeding-plan", "繁育计划"],
    ["aftercare", "售后保障"],
    ["questionnaire", "选猫问卷页面"],
    ["contact", "联系方式"],
  ] as const;
  for (const [slug, title] of pages) {
    await test.step(`preview ${slug}`, async () => {
      await page.goto(`/#fixed-pages/${slug}`);
      const editor = page.getByRole("complementary", { name: "固定页面编辑" });
      await expect(editor.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(editor.getByRole("button", { name: "预览未保存内容" })).toBeVisible();
      await editor.getByRole("button", { name: "预览未保存内容" }).click();
      const preview = page.getByRole("region", { name: "未保存内容预览" });
      await expect(preview).toBeVisible();
      await expect(preview.locator(".fixed-draft-preview-content"), slug).not.toBeEmpty();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
      await preview.getByRole("button", { name: "返回编辑" }).click();
    });
  }
});

test("home preview resolves an image selected in the unsaved draft", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("starlitsky.admin.session.token"));
  const headers = { authorization: `Bearer ${token}` };
  const seed = await request.patch(`${API_ORIGIN}/fixed-pages/home`, {
    headers,
    data: {
      title: "首页",
      status: "published",
      contentJson: {
        hero: { title: "测试首页", slides: [{ id: "preview-slide", label: "草稿图" }] },
      },
    },
  });
  expect(seed.status()).toBe(200);
  const homeId = (await seed.json()).data.id as string;
  const binding = await request.post(`${API_ORIGIN}/media/${E2E_LEGACY_MEDIA_ID}/bindings`, {
    headers,
    data: {
      ownerType: "fixed_page",
      ownerId: homeId,
      usage: "hero",
      sortOrder: 0,
      visibility: "visible",
    },
  });
  expect(binding.status()).toBe(201);
  await page.goto("/#fixed-pages/home");
  const editor = page.getByRole("complementary", { name: "固定页面编辑" });
  await expect(editor.getByLabel("主标题")).toHaveValue("测试首页");
  await editor.getByLabel("选择已上传图片").selectOption(E2E_LEGACY_MEDIA_ID);
  await editor.getByRole("button", { name: "预览未保存内容" }).click();
  const preview = page.getByRole("region", { name: "未保存内容预览" });
  await expect(preview.locator(".fixed-draft-preview-images img")).toBeVisible();
  const stored = await request.get(`${API_ORIGIN}/fixed-pages/home`, { headers });
  expect((await stored.json()).data.contentJson.hero.slides[0].imageId).toBeUndefined();
});

test("questionnaire preview includes unsaved question labels and success copy", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("starlitsky.admin.session.token"));
  const headers = { authorization: `Bearer ${token}` };
  await page.goto("/#fixed-pages/questionnaire");
  const editor = page.getByRole("complementary", { name: "固定页面编辑" });
  await editor.getByLabel("题目显示文字").first().fill("尚未保存的姓名问题");
  await editor.getByLabel("提交成功标题").fill("尚未保存的成功标题");
  await editor.getByRole("button", { name: "预览未保存内容" }).click();
  const preview = page.getByRole("region", { name: "未保存内容预览" });
  await expect(preview).toContainText("尚未保存的姓名问题");
  await expect(preview).toContainText("尚未保存的成功标题");
  const stored = await request.get(`${API_ORIGIN}/fixed-pages/questionnaire`, { headers });
  expect((await stored.json()).data.contentJson.basicInfo?.name?.label).not.toBe(
    "尚未保存的姓名问题",
  );
});
