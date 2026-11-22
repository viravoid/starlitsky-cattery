import { expect, test } from "@playwright/test";
import { API_ORIGIN, E2E_ADMIN_PASSWORD, E2E_ADMIN_USERNAME, TEST_PNG } from "./constants";

const evidence = "E:/小程序/photo-wall-evidence";

test("photo wall creates three photos and keeps cover, order, crop and visibility after refresh", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).toHaveTitle("星月缅因猫舍后台");
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem("starlitsky.admin.session.token"));
  expect(token).toBeTruthy();
  const headers = { authorization: `Bearer ${token}` };
  await page.getByRole("link", { name: "种猫" }).click();
  await page.getByRole("button", { name: "新增", exact: true }).first().click();
  await page.getByLabel("名字").fill("照片墙隔离测试猫");
  await page.getByLabel("添加照片").setInputFiles(
    ["wall-one.png", "wall-two.png", "wall-three.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: TEST_PNG,
    })),
  );
  await expect(page.getByText("待上传 · 3 张")).toBeVisible();
  await page
    .locator(".photo-card-pending")
    .nth(1)
    .getByRole("button", { name: "设为封面" })
    .click();
  await expect(page.locator(".photo-card-pending").nth(1).getByText("待上传封面")).toBeVisible();
  await page.getByText("待上传 · 3 张").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/after-pending-1440.png` });
  let leaveWarningShown = false;
  page.once("dialog", (dialog) => {
    leaveWarningShown = dialog.message().includes("未保存");
    return dialog.dismiss();
  });
  await page.getByRole("link", { name: "其它猫咪" }).click();
  await expect.poll(() => leaveWarningShown).toBe(true);
  await expect(page).toHaveURL(/#studs$/);
  await expect(page.getByText("待上传 · 3 张")).toBeVisible();
  const disconnectCreate = (url: URL) =>
    url.origin === API_ORIGIN && url.pathname.endsWith("/cats/with-breeding-profile");
  await page.route(disconnectCreate, (route) =>
    route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".error-banner")).toContainText("网络连接中断，请检查连接后重试");
  await expect(page.getByLabel("名字")).toHaveValue("照片墙隔离测试猫");
  await expect(page.getByText("待上传 · 3 张")).toBeVisible();
  await page.unroute(disconnectCreate);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("猫咪已新增")).toBeVisible();
  await expect(page.locator(".photo-card")).toHaveCount(3);
  await page.getByRole("heading", { name: "照片", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/after-wall-1440.png` });

  const catList = await request.get(`${API_ORIGIN}/cats?pageSize=100`, { headers });
  const catId = (await catList.json()).data.items.find(
    (cat: { name: string }) => cat.name === "照片墙隔离测试猫",
  ).id as string;
  const mediaResponse = await request.get(
    `${API_ORIGIN}/media?ownerType=cat&ownerId=${catId}&status=active&pageSize=100`,
    { headers },
  );
  const media = (await mediaResponse.json()).data.items as Array<{
    id: string;
    title: string;
    bindings: Array<{ usage: string; sortOrder: number; visibility: string }>;
  }>;
  expect(media).toHaveLength(3);
  const second = media.find((item) => item.title === "wall-two.png")!;
  const third = media.find((item) => item.title === "wall-three.png")!;
  expect(second.bindings[0].usage).toBe("cover");

  await page.getByRole("button", { name: "不同展示位置的图片设置" }).click();
  await page.getByRole("button", { name: "猫友圈展示", exact: true }).click();
  await page.getByRole("button", { name: "选择第 3 张作为猫友圈展示" }).click();
  const cropWidth = page.getByLabel("裁剪宽度").first();
  await cropWidth.focus();
  for (let step = 0; step < 35; step += 1) await cropWidth.press("ArrowLeft");
  await page.screenshot({ path: `${evidence}/after-crop-1440.png` });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("猫咪资料已更新")).toBeVisible();
  const catResponse = await request.get(`${API_ORIGIN}/cats/${catId}`, { headers });
  const savedCat = (await catResponse.json()).data;
  expect(savedCat.storyJson.imagePresentation.entryCoverSelections.communityProfile.imageId).toBe(
    third.id,
  );
  expect(
    savedCat.storyJson.imagePresentation.entryCoverSelections.communityProfile.cropRect.width,
  ).toBe(0.65);

  const firstCard = page
    .locator(".photo-card")
    .filter({ has: page.getByRole("img", { name: "wall-one.png" }) });
  await firstCard.getByText("更多操作").click();
  await firstCard.getByRole("button", { name: "隐藏照片" }).click();
  await expect(firstCard.getByText("已隐藏")).toBeVisible();
  const thirdCard = page
    .locator(".photo-card")
    .filter({ has: page.getByRole("img", { name: "wall-three.png" }) });
  await thirdCard.getByText("更多操作").click();
  page.once("dialog", (dialog) => dialog.accept());
  await thirdCard.getByRole("button", { name: "从这只猫的相册移除" }).click();
  await expect(page.locator(".photo-card")).toHaveCount(2);
  const secondCard = page
    .locator(".photo-card")
    .filter({ has: page.getByRole("img", { name: "wall-two.png" }) });
  await secondCard.getByText("更多操作").click();
  await secondCard.getByRole("button", { name: "向前移动" }).click();
  await expect(page.getByText("照片顺序已保存，刷新后仍会保持")).toBeVisible();
  await page.getByRole("heading", { name: "照片", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/after-actions-1440.png` });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: `${evidence}/after-wall-1280.png` });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("heading", { name: "照片", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/after-wall-390.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );

  await page.reload();
  await expect(page.getByRole("heading", { name: "种猫管理", level: 3 })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "照片墙隔离测试猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(page.locator(".photo-card")).toHaveCount(2);
  const reloaded = await request.get(
    `${API_ORIGIN}/media?ownerType=cat&ownerId=${catId}&status=active&pageSize=100`,
    { headers },
  );
  const reloadedMedia = (await reloaded.json()).data.items as typeof media;
  expect(reloadedMedia.find((item) => item.id === second.id)?.bindings[0].sortOrder).toBe(0);
  expect(reloadedMedia.find((item) => item.title === "wall-one.png")?.bindings[0].visibility).toBe(
    "hidden",
  );
  expect(reloadedMedia.some((item) => item.id === third.id)).toBe(false);
  await page.route("**/cos-e2e-new-bucket/**", (route) =>
    route.fulfill({ status: 503, body: "image unavailable" }),
  );
  await page.reload();
  await page
    .getByRole("row")
    .filter({ hasText: "照片墙隔离测试猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(page.getByText("照片暂时无法加载").first()).toBeVisible();
  await page.screenshot({ path: `${evidence}/after-image-failure-390.png` });
  await page.unroute("**/cos-e2e-new-bucket/**");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#cats");
  await page.getByRole("button", { name: "新增", exact: true }).first().click();
  await page.getByLabel("名字").fill("照片中断重试隔离猫");
  await page.getByLabel("添加照片").setInputFiles(
    ["retry-one.png", "retry-two.png", "retry-three.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: TEST_PNG,
    })),
  );
  let uploadCount = 0;
  await page.route("**/cos-e2e-new-bucket/**", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    uploadCount += 1;
    if (uploadCount === 2)
      await route.fulfill({ status: 503, body: "simulated second upload failure" });
    else await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("档案已保存，但后续步骤未完成", { exact: false })).toBeVisible();
  await expect(page.getByText("待上传 · 2 张")).toBeVisible();
  await page.getByText("待上传 · 2 张").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/after-upload-failure-1440.png` });
  await page.unroute("**/cos-e2e-new-bucket/**");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("猫咪资料已更新")).toBeVisible();
  await expect(page.locator(".photo-card")).toHaveCount(3);
  const retryCatsResponse = await request.get(`${API_ORIGIN}/cats?pageSize=100`, { headers });
  const matching = (await retryCatsResponse.json()).data.items.filter(
    (cat: { name: string }) => cat.name === "照片中断重试隔离猫",
  );
  expect(matching).toHaveLength(1);
  const retryMediaResponse = await request.get(
    `${API_ORIGIN}/media?ownerType=cat&ownerId=${matching[0].id}&status=active&pageSize=100`,
    { headers },
  );
  const retryMedia = (await retryMediaResponse.json()).data.items as Array<{
    bindings: Array<{ sortOrder: number }>;
  }>;
  expect(retryMedia).toHaveLength(3);
  expect(retryMedia.map((item) => item.bindings[0].sortOrder).sort()).toEqual([0, 1, 2]);
  expect(pageErrors).toEqual([]);
});
