import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FeedingView } from "@/components/mobile/FeedingView";
import { cloneFeedingContent, type FeedingContent } from "@/lib/feeding-content";
import {
  loadDraftPreviewFeedingContent,
  loadSavedFeedingContent,
  subscribeToSavedFeedingContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/feeding")({
  head: () => ({
    meta: [
      { title: "喂养体系 — 星月缅因猫舍" },
      {
        name: "description",
        content: "查看星月缅因猫舍的熟自制、猫粮·罐头·冻干与保健品喂养体系。",
      },
    ],
  }),
  component: Feeding,
});

function Feeding() {
  const [content, setContent] = useState<FeedingContent>(() => cloneFeedingContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "feeding-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewFeedingContent());
      return;
    }

    setContent(loadSavedFeedingContent());
    return subscribeToSavedFeedingContent(() => setContent(loadSavedFeedingContent()));
  }, []);

  return <FeedingView content={content} />;
}
