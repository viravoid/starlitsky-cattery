import assert from "node:assert/strict";

import { mergeCatStoryTextFields } from "./cat-story-json.ts";

const original = {
  detail: "old detail",
  diet: "old diet",
  imagePresentation: {
    coverPresentations: {
      listCard: { objectPositionX: 50, objectPositionY: 40, zoom: 1.2 },
    },
  },
  personality: ["calm", "friendly"],
  unknownKey: { nested: true },
};

const saved = mergeCatStoryTextFields(original, {
  detail: "",
  diet: "updated diet",
  personality: "calm\nfriendly",
});
const roundTripped = JSON.parse(JSON.stringify(saved));

assert.equal(
  Object.hasOwn(roundTripped, "detail"),
  false,
  "an explicitly cleared displayed field should be removed",
);
assert.equal(roundTripped.diet, "updated diet", "an edited displayed field should be updated");
assert.deepEqual(
  roundTripped.personality,
  ["calm", "friendly"],
  "an unedited displayed field should retain its original representation",
);
assert.deepEqual(
  roundTripped.unknownKey,
  { nested: true },
  "unknown storyJson keys should survive the round trip",
);
assert.deepEqual(
  roundTripped.imagePresentation,
  original.imagePresentation,
  "imagePresentation should survive the round trip",
);

console.info("cat storyJson round-trip verification passed");
