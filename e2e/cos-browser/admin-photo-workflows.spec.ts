import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  API_ORIGIN,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_CAT_ID,
  E2E_LEGACY_MEDIA_ID,
  TEST_PNG,
} from "./constants";

test("admin can add gallery photos and replace one without leaving stale presentation references", async ({
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

  const seed = await request.patch(`${API_ORIGIN}/cats/${E2E_CAT_ID}`, {
    headers,
    data: {
      storyJson: {
        imagePresentation: {
          entryCoverSelections: {
            listCard: {
              imageId: E2E_LEGACY_MEDIA_ID,
              cropRect: { x: 0.2, y: 0.1, width: 0.5, height: 0.5 },
            },
          },
          detailImagePresentations: {
            [E2E_LEGACY_MEDIA_ID]: { mode: "original" },
          },
          detailCarouselPresentations: {
            [E2E_LEGACY_MEDIA_ID]: { objectPositionX: 45, objectPositionY: 55, zoom: 1.2 },
          },
        },
      },
    },
  });
  expect(seed.status()).toBe(200);
  const motherResponse = await request.post(`${API_ORIGIN}/cats`, {
    headers,
    data: { name: "COS E2E 母猫", gender: "female", visibility: "visible" },
  });
  expect(motherResponse.status()).toBe(201);
  const motherId = (await motherResponse.json()).data.id as string;
  const litterResponse = await request.post(`${API_ORIGIN}/litters`, {
    headers,
    data: {
      name: "COS E2E 隔离测试窝次",
      fatherCatId: E2E_CAT_ID,
      motherCatId: motherId,
      status: "planned",
      visibility: "visible",
    },
  });
  expect(litterResponse.status()).toBe(201);
  const litterId = (await litterResponse.json()).data.id as string;
  const litterBinding = await request.post(`${API_ORIGIN}/media/${E2E_LEGACY_MEDIA_ID}/bindings`, {
    headers,
    data: {
      ownerType: "litter",
      ownerId: litterId,
      usage: "gallery",
      sortOrder: 7,
      visibility: "visible",
    },
  });
  expect(litterBinding.status()).toBe(201);

  await page.getByRole("link", { name: "其它猫咪" }).click();
  await page.getByLabel("搜索猫咪").fill("COS E2E 隔离测试猫");
  await expect(page.getByText("COS E2E 隔离测试猫")).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "COS E2E 隔离测试猫" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(page.getByRole("heading", { name: "猫咪档案" })).toBeVisible();

  await page.getByLabel("批量加入相册").setInputFiles(
    ["gallery-first.png", "gallery-second.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: TEST_PNG,
    })),
  );
  await expect(page.getByText("已加入 2 张相册图片")).toBeVisible();
  const afterBatch = await listOwnerMedia(request, headers, "cat", E2E_CAT_ID);
  for (const [index, name] of ["gallery-first.png", "gallery-second.png"].entries()) {
    const media = afterBatch.find((item) => item.title === name);
    expect(media).toBeDefined();
    expect(media?.bindings[0]).toMatchObject({
      ownerId: E2E_CAT_ID,
      usage: "gallery",
      visibility: "visible",
      sortOrder: index + 1,
    });
  }

  const legacyRow = page.locator(".image-gallery-row").filter({
    has: page.getByRole("img", { name: "isolated legacy private image" }),
  });
  await legacyRow.getByLabel("替换图片").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: TEST_PNG,
  });
  await expect(page.getByText("猫咪图片已替换")).toBeVisible();

  const afterReplace = await listOwnerMedia(request, headers, "cat", E2E_CAT_ID);
  const replacement = afterReplace.find((item) => item.title === "replacement.png");
  expect(replacement).toBeDefined();
  expect(replacement?.bindings[0]).toMatchObject({
    ownerId: E2E_CAT_ID,
    usage: "gallery",
    visibility: "visible",
    sortOrder: 0,
  });
  expect(afterReplace.some((item) => item.id === E2E_LEGACY_MEDIA_ID)).toBe(false);

  const catResponse = await request.get(`${API_ORIGIN}/cats/${E2E_CAT_ID}`, { headers });
  expect(catResponse.status()).toBe(200);
  const cat = (await catResponse.json()).data;
  const presentation = cat.storyJson.imagePresentation;
  expect(presentation.entryCoverSelections.listCard).toEqual({
    imageId: replacement?.id,
    cropRect: { x: 0, y: 0, width: 1, height: 1 },
  });
  expect(presentation.detailImagePresentations?.[E2E_LEGACY_MEDIA_ID]).toBeUndefined();
  expect(presentation.detailCarouselPresentations?.[E2E_LEGACY_MEDIA_ID]).toBeUndefined();

  const originalResponse = await request.get(`${API_ORIGIN}/media/${E2E_LEGACY_MEDIA_ID}`, {
    headers,
  });
  expect(originalResponse.status()).toBe(200);
  const original = (await originalResponse.json()).data;
  expect(original.status).toBe("active");
  expect(
    original.bindings.some(
      (binding: { ownerId: string; deletedAt: string | null }) =>
        binding.ownerId === E2E_CAT_ID && !binding.deletedAt,
    ),
  ).toBe(false);
  expect(
    original.bindings.some(
      (binding: { ownerId: string; deletedAt: string | null }) =>
        binding.ownerId === litterId && !binding.deletedAt,
    ),
  ).toBe(true);

  await page.getByRole("link", { name: "窝次" }).click();
  await page.getByRole("button", { name: "刷新" }).click();
  await expect(page.getByText("COS E2E 隔离测试窝次")).toBeVisible();
  await page.getByRole("button", { name: "编辑" }).first().click();
  await expect(page.getByRole("heading", { name: "窝次编辑" })).toBeVisible();
  const litterLegacyRow = page.locator(".image-gallery-row").filter({
    has: page.getByRole("img", { name: "isolated legacy private image" }),
  });
  await litterLegacyRow.getByLabel("替换图片").setInputFiles({
    name: "litter-replacement.png",
    mimeType: "image/png",
    buffer: TEST_PNG,
  });
  await expect(page.getByText("窝次图片已替换")).toBeVisible();
  const litterMedia = await listOwnerMedia(request, headers, "litter", litterId);
  expect(litterMedia.some((item) => item.id === E2E_LEGACY_MEDIA_ID)).toBe(false);
  expect(
    litterMedia.find((item) => item.title === "litter-replacement.png")?.bindings[0],
  ).toMatchObject({
    ownerId: litterId,
    usage: "gallery",
    sortOrder: 7,
    visibility: "visible",
  });
});

async function listOwnerMedia(
  request: APIRequestContext,
  headers: Record<string, string>,
  ownerType: string,
  ownerId: string,
) {
  const response = await request.get(
    `${API_ORIGIN}/media?ownerType=${ownerType}&ownerId=${ownerId}&status=active&pageSize=100`,
    { headers },
  );
  expect(response.status()).toBe(200);
  return (await response.json()).data.items as Array<{
    id: string;
    title: string | null;
    bindings: Array<{ ownerId: string; usage: string; visibility: string; sortOrder: number }>;
  }>;
}
