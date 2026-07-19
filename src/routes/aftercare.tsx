import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AftercareView } from "@/components/mobile/AftercareView";
import { cloneAftercareContent, type AftercareContent } from "@/lib/aftercare-content";
import {
  loadDraftPreviewAftercareContent,
  loadSavedAftercareContent,
  subscribeToSavedAftercareContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/aftercare")({
  head: () => ({
    meta: [
      { title: "售后保障 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍售后保障：种猫遗传病筛查 all n/n，科学低频繁育，去新家前完成疫苗、抗体检测、基础检查、绝育与驱虫。",
      },
      { property: "og:title", content: "售后保障 — 星月缅因猫舍" },
      {
        property: "og:description",
        content: "遗传病筛查、疫苗、抗体检测、基础检查、绝育、驱虫与心超报销，具体以合同为准。",
      },
    ],
  }),
  component: Aftercare,
});

function Aftercare() {
  const [content, setContent] = useState<AftercareContent>(() => cloneAftercareContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "aftercare-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewAftercareContent());
      return;
    }

    setContent(loadSavedAftercareContent());
    return subscribeToSavedAftercareContent(() => setContent(loadSavedAftercareContent()));
  }, []);

  return <AftercareView content={content} />;
}
