import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QuestionnaireView } from "@/components/mobile/QuestionnaireView";
import { cloneQuestionnaireContent, type QuestionnaireContent } from "@/lib/questionnaire-content";
import {
  loadDraftPreviewQuestionnaireContent,
  loadSavedQuestionnaireContent,
  subscribeToSavedQuestionnaireContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/questionnaire")({
  head: () => ({
    meta: [
      { title: "选猫问卷 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍双向选择问卷，帮助我们了解你的养猫环境、饲养理念与选猫需求，方便后续沟通。",
      },
    ],
  }),
  component: Questionnaire,
});

function Questionnaire() {
  const [content, setContent] = useState<QuestionnaireContent>(() => cloneQuestionnaireContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "questionnaire-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewQuestionnaireContent());
      return;
    }

    setContent(loadSavedQuestionnaireContent());
    return subscribeToSavedQuestionnaireContent(() => setContent(loadSavedQuestionnaireContent()));
  }, []);

  return <QuestionnaireView content={content} />;
}
