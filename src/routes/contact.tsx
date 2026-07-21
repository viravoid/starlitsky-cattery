import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ContactView } from "@/components/mobile/ContactView";
import { cloneContactContent, type ContactContent } from "@/lib/contact-content";
import {
  loadDraftPreviewContactContent,
  loadSavedContactContent,
  subscribeToSavedContactContent,
} from "@/lib/site-page-storage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "联系方式 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍联系方式：微信、小红书、微博、抖音与小猫日常号，均可一键复制添加咨询。",
      },
      { property: "og:title", content: "联系方式 — 星月缅因猫舍" },
      {
        property: "og:description",
        content: "微信、小红书、微博、抖音与小猫日常号，欢迎来聊聊猫、看看小猫日常。",
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [content, setContent] = useState<ContactContent>(() => cloneContactContent());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewDraft = params.get("sitePagePreview") === "contact-draft";

    if (previewDraft) {
      setContent(loadDraftPreviewContactContent());
      return;
    }

    setContent(loadSavedContactContent());
    return subscribeToSavedContactContent(() => setContent(loadSavedContactContent()));
  }, []);

  return <ContactView content={content} />;
}
