import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ADMIN_ORIGIN,
  API_ORIGIN,
  COS_ORIGIN,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_CAT_ID,
  E2E_LEGACY_BUCKET,
  E2E_LEGACY_MEDIA_ID,
  E2E_NEW_BUCKET,
  TEST_PNG,
} from "./constants";

test("isolated browser upload acceptance covers success, replay, failures, timeout, and dual-bucket reads", async ({
  page,
  request,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const apiPreflight = await request.fetch(`${API_ORIGIN}/media/uploads`, {
    method: "OPTIONS",
    headers: {
      origin: ADMIN_ORIGIN,
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  expect(apiPreflight.status()).toBe(204);
  expect(apiPreflight.headers()["access-control-allow-origin"]).toBe(ADMIN_ORIGIN);

  const cosPreflight = await request.fetch(
    `${COS_ORIGIN}/${E2E_NEW_BUCKET}/cos-e2e/http-preflight.png`,
    {
      method: "OPTIONS",
      headers: {
        origin: ADMIN_ORIGIN,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    },
  );
  expect(cosPreflight.status()).toBe(204);
  expect(cosPreflight.headers()["access-control-allow-origin"]).toBe(ADMIN_ORIGIN);
  const blockedCosPreflight = await request.fetch(
    `${COS_ORIGIN}/${E2E_NEW_BUCKET}/cos-e2e/http-preflight.png`,
    {
      method: "OPTIONS",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    },
  );
  expect(blockedCosPreflight.status()).toBe(403);
  expect(blockedCosPreflight.headers()["access-control-allow-origin"]).toBeUndefined();
  await clearCosEvents(request);

  const uploadRequests: string[] = [];
  page.on("request", (browserRequest) => {
    if (
      browserRequest.method() === "POST" &&
      browserRequest.url() === `${API_ORIGIN}/media/uploads`
    ) {
      uploadRequests.push(browserRequest.url());
    }
  });

  await page.goto("/");
  await expect(page).toHaveTitle("星月缅因猫舍后台");
  await expect(page.getByRole("heading", { name: "后台登录" })).toBeVisible();
  await page.getByLabel("账号").fill(E2E_ADMIN_USERNAME);
  await page.getByLabel("密码").fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText(E2E_ADMIN_USERNAME)).toBeVisible();
  await page.getByRole("link", { name: "媒体库" }).click();
  await expect(page).toHaveURL(/#media$/);
  await expect(
    page.locator(".media-library-header").getByRole("heading", { name: "媒体管理" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "上传图片" }).click();
  const uploadForm = page.locator("form.media-form-card");
  await uploadForm.locator('input[type="file"]').setInputFiles({
    name: "isolated-success.png",
    mimeType: "image/png",
    buffer: TEST_PNG,
  });
  await uploadForm.getByLabel("标题").fill("COS E2E isolated successful upload");
  const signResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === `${API_ORIGIN}/media/uploads` && response.request().method() === "POST",
  );
  const completeResponsePromise = page.waitForResponse((response) =>
    /\/media\/[^/]+\/upload\/complete$/.test(response.url()),
  );
  const submit = uploadForm.getByRole("button", { name: "上传并创建绑定" });
  await expect(submit).toBeEnabled();
  await submit.click();

  const signResponse = await signResponsePromise;
  expect(signResponse.status()).toBe(201);
  const signPayload = await signResponse.json();
  expect(new URL(signPayload.data.upload.url).origin).toBe(COS_ORIGIN);
  expect(signPayload.data.upload.method).toBe("PUT");
  expect(signPayload.data.media.status).toBe("pending");
  expect(signPayload.data.media.metadataJson.upload.bucket).toBe(E2E_NEW_BUCKET);

  const completeResponse = await completeResponsePromise;
  expect(completeResponse.status()).toBe(200);
  const completePayload = await completeResponse.json();
  const uploadedMedia = completePayload.data;
  expect(uploadedMedia.status).toBe("active");
  expect(uploadedMedia.bindings).toHaveLength(1);
  expect(uploadedMedia.bindings[0].ownerId).toBe(E2E_CAT_ID);
  await expect(page.getByRole("status")).toContainText("图片已上传到 COS");
  await expect(
    page.getByRole("heading", { name: "COS E2E isolated successful upload" }),
  ).toBeVisible();

  const successEvents = await readCosEvents(request);
  expect(
    successEvents.some(
      (event) =>
        event.method === "OPTIONS" &&
        event.bucket === E2E_NEW_BUCKET &&
        event.objectKey === signPayload.data.objectKey &&
        event.origin === ADMIN_ORIGIN,
    ),
  ).toBe(true);
  expect(
    successEvents.some(
      (event) =>
        event.method === "PUT" &&
        event.objectKey === signPayload.data.objectKey &&
        event.status === 200,
    ),
  ).toBe(true);
  expect(
    successEvents.some(
      (event) =>
        event.method === "HEAD" &&
        event.objectKey === signPayload.data.objectKey &&
        event.status === 200,
    ),
  ).toBe(true);

  const replay = await page.evaluate(
    async ({ apiOrigin, mediaId, sizeBytes }) => {
      const token = localStorage.getItem("starlitsky.admin.session.token");
      const response = await fetch(`${apiOrigin}/media/${mediaId}/upload/complete`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sizeBytes, width: 1, height: 1 }),
      });
      return { status: response.status, payload: await response.json() };
    },
    { apiOrigin: API_ORIGIN, mediaId: uploadedMedia.id, sizeBytes: TEST_PNG.length },
  );
  expect(replay.status).toBe(200);
  expect(replay.payload.data.id).toBe(uploadedMedia.id);
  expect(replay.payload.data.bindings).toHaveLength(1);
  expect(uploadRequests).toHaveLength(1);

  const privateReads = await page.evaluate(
    async ({ apiOrigin, legacyMediaId, newMediaId, legacyUnsignedUrl }) => {
      const token = localStorage.getItem("starlitsky.admin.session.token");
      const headers = { authorization: `Bearer ${token}` };
      const [legacyResponse, newResponse] = await Promise.all([
        fetch(`${apiOrigin}/media/${legacyMediaId}`, { headers }),
        fetch(`${apiOrigin}/media/${newMediaId}`, { headers }),
      ]);
      const legacy = (await legacyResponse.json()).data;
      const current = (await newResponse.json()).data;
      const [legacyRead, currentRead, unsignedRead] = await Promise.all([
        fetch(legacy.sourceUrl),
        fetch(current.sourceUrl),
        fetch(legacyUnsignedUrl),
      ]);
      return {
        legacyHost: new URL(legacy.sourceUrl).origin,
        legacyStatus: legacyRead.status,
        newHost: new URL(current.sourceUrl).origin,
        newStatus: currentRead.status,
        unsignedStatus: unsignedRead.status,
      };
    },
    {
      apiOrigin: API_ORIGIN,
      legacyMediaId: E2E_LEGACY_MEDIA_ID,
      newMediaId: uploadedMedia.id,
      legacyUnsignedUrl: `${COS_ORIGIN}/${E2E_LEGACY_BUCKET}/cos-e2e/legacy/private-legacy.png`,
    },
  );
  expect(privateReads).toEqual({
    legacyHost: COS_ORIGIN,
    legacyStatus: 200,
    newHost: COS_ORIGIN,
    newStatus: 200,
    unsignedStatus: 403,
  });
  const readEvents = await readCosEvents(request);
  expect(
    readEvents.some(
      (event) =>
        event.method === "GET" && event.bucket === E2E_LEGACY_BUCKET && event.status === 200,
    ),
  ).toBe(true);
  expect(
    readEvents.some(
      (event) => event.method === "GET" && event.bucket === E2E_NEW_BUCKET && event.status === 200,
    ),
  ).toBe(true);

  await page.screenshot({
    path: join(tmpdir(), "starlitsky-cos-browser-e2e-success.png"),
    fullPage: false,
  });

  await clearCosEvents(request);
  await armNextPut(request, "fail");
  await page.getByRole("button", { name: "上传图片" }).click();
  const failureForm = page.locator("form.media-form-card");
  await failureForm.locator('input[type="file"]').setInputFiles({
    name: "isolated-failure.png",
    mimeType: "image/png",
    buffer: TEST_PNG,
  });
  await failureForm.getByLabel("标题").fill("COS E2E injected failure");
  await expect(failureForm.getByRole("button", { name: "上传并创建绑定" })).toBeEnabled();
  await failureForm.getByRole("button", { name: "上传并创建绑定" }).click();
  await expect(page.getByRole("alert")).toContainText("HTTP 503");

  await armNextPut(request, "hang");
  await failureForm.getByLabel("标题").fill("COS E2E injected timeout");
  await failureForm.getByRole("button", { name: "上传并创建绑定" }).click();
  await expect(page.getByRole("alert")).toContainText("timed out after 800 ms");
  const failureEvents = await readCosEvents(request);
  expect(
    failureEvents.filter((event) => event.method === "PUT" && event.status === 503),
  ).toHaveLength(1);
  expect(
    failureEvents.filter((event) => event.method === "PUT" && event.status === 0),
  ).toHaveLength(1);
  expect(failureEvents.some((event) => event.method === "HEAD")).toBe(false);
  expect(pageErrors).toEqual([]);
  expect(
    consoleErrors.filter(
      (message) =>
        !/status of (403|404|503)/i.test(message) && !/ERR_(ABORTED|FAILED)/i.test(message),
    ),
  ).toEqual([]);
});

async function clearCosEvents(request: { delete: (url: string) => Promise<unknown> }) {
  await request.delete(`${COS_ORIGIN}/_test/events`);
}

async function armNextPut(
  request: { post: (url: string, options: { data: unknown }) => Promise<unknown> },
  mode: "fail" | "hang",
) {
  await request.post(`${COS_ORIGIN}/_test/next-put`, { data: { mode } });
}

async function readCosEvents(request: {
  get: (url: string) => Promise<{ json: () => Promise<any> }>;
}) {
  return (await (await request.get(`${COS_ORIGIN}/_test/events`)).json()).events as Array<{
    method: string;
    bucket: string;
    objectKey: string;
    origin?: string | null;
    status: number;
  }>;
}
