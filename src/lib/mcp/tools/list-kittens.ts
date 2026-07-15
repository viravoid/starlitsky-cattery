import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { KITTENS, type KittenStatus } from "@/lib/cattery-data";

const STATUSES = ["待找家", "找家中", "已有家"] as const;

export default defineTool({
  name: "list_kittens",
  title: "List kittens",
  description:
    "List kittens currently displayed on the StarlitSky Maine Coon Cattery site, optionally filtered by status (待找家 / 找家中 / 已有家).",
  inputSchema: {
    status: z
      .enum(STATUSES)
      .optional()
      .describe("Optional status filter: 待找家, 找家中, or 已有家."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status }) => {
    const items = status
      ? KITTENS.filter((k) => k.status === (status as KittenStatus))
      : KITTENS;
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { count: items.length, items },
    };
  },
});
