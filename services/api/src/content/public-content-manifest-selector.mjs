import { PUBLIC_CONTENT_MANIFEST } from "./public-content-manifest.mjs";

export const PUBLIC_CONTENT_MANIFEST_SELECTIONS = new Set(["legacy", "web-demo", "demo"]);

export async function loadPublicContentManifest(selection = "legacy") {
  const normalized = normalizeManifestSelection(selection);
  if (normalized === "legacy") return PUBLIC_CONTENT_MANIFEST;

  const { WEB_DEMO_PUBLIC_CONTENT_MANIFEST } = await import("./web-demo-content-transformer.mjs");
  return WEB_DEMO_PUBLIC_CONTENT_MANIFEST;
}

export function normalizeManifestSelection(selection = "legacy") {
  const normalized = String(selection || "legacy").trim();
  if (normalized === "demo") return "web-demo";
  if (PUBLIC_CONTENT_MANIFEST_SELECTIONS.has(normalized)) return normalized;
  throw new Error(
    `Unsupported public content manifest "${selection}". Use one of: legacy, web-demo.`,
  );
}
