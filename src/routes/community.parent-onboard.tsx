import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PawIcon, CheckIcon } from "@/components/mobile/icons";
import { actions, useCommunity } from "@/lib/community-store";
import { findWechatAccount, type ContactContent } from "@/lib/contact-content";
import { loadSavedContactContent, subscribeToSavedContactContent } from "@/lib/site-page-storage";

export const Route = createFileRoute("/community/parent-onboard")({
  head: () => ({ meta: [{ title: "开通家长身份 — 猫友圈" }] }),
  component: ParentOnboard,
});

function ParentOnboard() {
  const navigate = useNavigate();
  const role = useCommunity((s) => s.role);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contactContent, setContactContent] = useState<ContactContent | null>(null);
  const wechatAccount = contactContent ? findWechatAccount(contactContent) : null;
  const wechatValue = wechatAccount?.value.trim() ?? "";

  useEffect(() => {
    setContactContent(loadSavedContactContent());
    return subscribeToSavedContactContent(() => setContactContent(loadSavedContactContent()));
  }, []);

  const submit = () => {
    if (!code.trim()) {
      alert("请填写邀请码");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      actions.activateParent(code.trim());
      navigate({ to: "/community/my-cats" });
    }, 400);
  };

  if (role === "parent") {
    return (
      <PhoneFrame title="家长身份" showBack>
        <Section className="py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint/50">
            <CheckIcon className="h-7 w-7 text-[#6b8db3]" />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-heading">你已开通家长身份</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            现在可以添加自家猫咪，并发布家长分享。
          </p>
        </Section>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame title="开通家长身份" showBack>
      <Section className="space-y-6 py-7">
        <div className="soft-card space-y-3 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet/15">
            <PawIcon className="h-6 w-6 text-violet" />
          </span>
          <h2 className="text-[16px] font-semibold text-heading">星月家长身份</h2>
          <p className="text-[13px] leading-[1.9] text-card-foreground">
            接猫成功的家长可通过猫舍提供的专属邀请码开通身份，之后可以：
          </p>
          <ul className="space-y-2 pt-1 text-[12.5px] leading-[1.9] text-muted-foreground">
            <li>· 添加并管理自己的猫咪档案</li>
            <li>· 在猫友圈发布家长分享</li>
            <li>· 关联小猫，为它生成成长时光轴</li>
          </ul>
        </div>

        <label className="block space-y-2 pt-1">
          <span className="block text-[12.5px] font-medium text-heading">猫舍邀请码</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="示例：XY-HUHU-2025"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-[14px] outline-none focus:border-primary"
          />
        </label>

        <button
          onClick={submit}
          disabled={submitting}
          className="pressable mt-2 w-full rounded-full bg-violet py-3.5 text-[15px] font-semibold text-white shadow-card disabled:opacity-60"
        >
          {submitting ? "开通中…" : "开通家长身份"}
        </button>

        <p className="pt-2 text-center text-[11.5px] leading-[1.9] text-warm">
          {wechatValue ? (
            <>
              还没有邀请码？请添加主理人微信
              <br />
              {wechatValue} 索取。
            </>
          ) : (
            <>
              还没有邀请码？
              <Link to="/contact" className="font-semibold underline underline-offset-4">
                请前往联系方式页面联系猫舍
              </Link>
            </>
          )}
        </p>
      </Section>
    </PhoneFrame>
  );
}
