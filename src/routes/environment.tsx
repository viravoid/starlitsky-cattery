import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EnvironmentView } from "@/components/mobile/EnvironmentView";
import { cloneEnvironmentContent, type EnvironmentContent } from "@/lib/environment-content";
import {
  loadDraftPreviewEnvironmentContent,
  loadSavedEnvironmentContent,
  subscribeToSavedEnvironmentContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/environment")({
  component: Environment,
});

function Environment() {
  const [content, setContent] = useState<EnvironmentContent>(() => cloneEnvironmentContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "environment-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewEnvironmentContent());
      return;
    }

    setContent(loadSavedEnvironmentContent());
    return subscribeToSavedEnvironmentContent(() => setContent(loadSavedEnvironmentContent()));
  }, []);

  return <EnvironmentView content={content} />;
}
