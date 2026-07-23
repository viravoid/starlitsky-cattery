import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BreedingPlanView } from "@/components/mobile/BreedingPlanView";
import { cloneBreedingPlanContent, type BreedingPlanContent } from "@/lib/breeding-plan-content";
import { STUDS } from "@/lib/cattery-data";
import {
  loadDraftPreviewBreedingPlanContent,
  loadSavedBreedingPlanContent,
  subscribeToSavedBreedingPlanContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/breeding-plan")({
  head: () => ({
    meta: [
      { title: "繁育计划 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍 2026 年下半年繁育组合、预计时间和预计花色记录，具体安排以实际情况为准。",
      },
    ],
  }),
  component: BreedingPlan,
});

function BreedingPlan() {
  const [content, setContent] = useState<BreedingPlanContent>(() => cloneBreedingPlanContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "breeding-plan-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewBreedingPlanContent());
      return;
    }

    setContent(loadSavedBreedingPlanContent());
    return subscribeToSavedBreedingPlanContent(() => setContent(loadSavedBreedingPlanContent()));
  }, []);

  return <BreedingPlanView content={content} studs={STUDS} />;
}
