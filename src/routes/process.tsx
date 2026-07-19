import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProcessView } from "@/components/mobile/ProcessView";
import { cloneProcessContent, type ProcessContent } from "@/lib/process-content";
import {
  loadDraftPreviewProcessContent,
  loadSavedProcessContent,
  subscribeToSavedProcessContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/process")({
  component: Process,
});

function Process() {
  const [content, setContent] = useState<ProcessContent>(() => cloneProcessContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "process-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewProcessContent());
      return;
    }

    setContent(loadSavedProcessContent());
    return subscribeToSavedProcessContent(() => setContent(loadSavedProcessContent()));
  }, []);

  return <ProcessView content={content} />;
}
