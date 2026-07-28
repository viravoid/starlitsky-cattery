import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EnvironmentView } from "@/components/mobile/EnvironmentView";
import { cloneEnvironmentContent, type EnvironmentContent } from "@/lib/environment-content";
import {
  loadDraftPreviewEnvironmentContent,
  loadSavedEnvironmentContent,
  subscribeToSavedEnvironmentContent,
} from "@/lib/site-page-storage";

const PREVIEW_TOKEN = "environment-draft";

export const Route = createFileRoute("/environment/")({
  component: EnvironmentOverviewRoute,
});

function EnvironmentOverviewRoute() {
  const [content, setContent] = useState<EnvironmentContent>(() => cloneEnvironmentContent());
  const [previewToken, setPreviewToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentPreviewToken =
      params.get("sitePagePreview") === PREVIEW_TOKEN ? PREVIEW_TOKEN : undefined;
    setPreviewToken(currentPreviewToken);

    if (currentPreviewToken) {
      setContent(loadDraftPreviewEnvironmentContent());
      return;
    }

    setContent(loadSavedEnvironmentContent());
    return subscribeToSavedEnvironmentContent(() => setContent(loadSavedEnvironmentContent()));
  }, []);

  return <EnvironmentView content={content} previewToken={previewToken} />;
}
