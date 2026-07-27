import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import {
  EnvironmentSectionDetailView,
  EnvironmentSectionNotFoundView,
} from "@/components/mobile/EnvironmentSectionDetailView";
import {
  cloneEnvironmentContent,
  getEnvironmentSectionById,
  type EnvironmentContent,
} from "@/lib/environment-content";
import {
  loadDraftPreviewEnvironmentContent,
  loadSavedEnvironmentContent,
  subscribeToSavedEnvironmentContent,
} from "@/lib/site-page-storage";

const PREVIEW_TOKEN = "environment-draft";

export const Route = createFileRoute("/environment/$sectionId")({
  component: EnvironmentSectionDetailRoute,
});

function EnvironmentSectionDetailRoute() {
  const { sectionId } = useParams({ from: "/environment/$sectionId" });
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

  const section = getEnvironmentSectionById(content, sectionId);
  if (!section) {
    return <EnvironmentSectionNotFoundView previewToken={previewToken} />;
  }

  return (
    <EnvironmentSectionDetailView content={content} section={section} previewToken={previewToken} />
  );
}
