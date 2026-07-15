import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { STUDS, type StudCategory } from "@/lib/cattery-data";

const CATEGORIES = ["现役公猫", "现役母猫", "预备役种猫"] as const;

export default defineTool({
  name: "list_studs",
  title: "List breeding cats",
  description:
    "List StarlitSky Maine Coon Cattery breeding cats (种猫), optionally filtered by category (现役公猫 / 现役母猫 / 预备役种猫).",
  inputSchema: {
    category: z
      .enum(CATEGORIES)
      .optional()
      .describe("Optional category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const items = category
      ? STUDS.filter((s) => s.category === (category as StudCategory))
      : STUDS;
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { count: items.length, items },
    };
  },
});
