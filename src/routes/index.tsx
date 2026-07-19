import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HomepageView } from "@/components/mobile/HomepageView";
import { cloneHomepageContent, type HomepageContent } from "@/lib/homepage-content";
import {
  loadDraftPreviewHomepageContent,
  loadSavedHomepageContent,
  subscribeToSavedHomepageContent,
} from "@/lib/homepage-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "星月缅因猫舍 — 做一家有温度的缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍 StarlitSky Maine Coon Cattery，2019 年成立于西安，注册于 WCF、CFA。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。",
      },
      { property: "og:title", content: "星月缅因猫舍 — 做一家有温度的缅因猫舍" },
      {
        property: "og:description",
        content:
          "了解星月缅因猫舍的介绍、繁育理念、环境、喂养、接猫流程与售后保障，查看在售小猫与种猫。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [content, setContent] = useState<HomepageContent>(() => cloneHomepageContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("homepagePreview") === "draft";

    if (previewDraft) {
      setContent(loadDraftPreviewHomepageContent());
      return;
    }

    setContent(loadSavedHomepageContent());
    return subscribeToSavedHomepageContent(() => setContent(loadSavedHomepageContent()));
  }, []);

  return <HomepageView content={content} />;
}
