export const EDITABLE_CAT_STORY_TEXT_KEYS = ["detail", "diet", "personality"] as const;

type EditableCatStoryTextKey = (typeof EDITABLE_CAT_STORY_TEXT_KEYS)[number];

export function mergeCatStoryTextFields(
  existing: unknown,
  values: Record<EditableCatStoryTextKey, string>,
) {
  const next = isRecord(existing) ? { ...existing } : {};

  for (const key of EDITABLE_CAT_STORY_TEXT_KEYS) {
    const value = values[key];
    if (Object.hasOwn(next, key) && value === readCatStoryText(next, key)) continue;

    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
    else delete next[key];
  }

  return next;
}

export function readCatStoryText(storyJson: unknown, key: string) {
  if (!isRecord(storyJson)) return "";
  const value = storyJson[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join("\n");
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
