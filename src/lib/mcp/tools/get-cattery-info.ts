import { defineTool } from "@lovable.dev/mcp-js";
import { SOCIALS, WECHAT_ID } from "@/lib/cattery-data";

const BRAND = {
  name_cn: "星月缅因猫舍",
  name_en: "StarlitSky Maine Coon Cattery",
  founded: "2019",
  location: "西安",
  registrations: ["WCF", "CFA"],
  positioning:
    "自繁自养的缅因猫舍，重视健康筛查、社会化训练、低频率繁育、别墅散养、拒绝笼养。",
  values:
    "繁育体质好、抵抗力强、乖巧亲人、大方自信的小猫；从出生记录到去新家；做一家有温度的猫舍。",
};

export default defineTool({
  name: "get_cattery_info",
  title: "Get cattery info",
  description:
    "Get StarlitSky Maine Coon Cattery brand info and contact channels (WeChat, Xiaohongshu, Weibo, Douyin).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const info = { brand: BRAND, wechat_id: WECHAT_ID, socials: SOCIALS };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
