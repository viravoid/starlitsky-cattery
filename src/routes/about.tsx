import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AboutView } from "@/components/mobile/AboutView";
import { cloneAboutContent, type AboutContent } from "@/lib/about-content";
import {
  loadDraftPreviewAboutContent,
  loadSavedAboutContent,
  subscribeToSavedAboutContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  const [content, setContent] = useState<AboutContent>(() => cloneAboutContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "about-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewAboutContent());
      return;
    }

    setContent(loadSavedAboutContent());
    return subscribeToSavedAboutContent(() => setContent(loadSavedAboutContent()));
  }, []);

  return <AboutView content={content} />;
}
