import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PhilosophyView } from "@/components/mobile/PhilosophyView";
import { clonePhilosophyContent, type PhilosophyContent } from "@/lib/philosophy-content";
import {
  loadDraftPreviewPhilosophyContent,
  loadSavedPhilosophyContent,
  subscribeToSavedPhilosophyContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/philosophy")({
  component: Philosophy,
});

function Philosophy() {
  const [content, setContent] = useState<PhilosophyContent>(() => clonePhilosophyContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "philosophy-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewPhilosophyContent());
      return;
    }

    setContent(loadSavedPhilosophyContent());
    return subscribeToSavedPhilosophyContent(() => setContent(loadSavedPhilosophyContent()));
  }, []);

  return <PhilosophyView content={content} />;
}
