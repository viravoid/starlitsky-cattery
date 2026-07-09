import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { HeartPaw } from "@/components/mobile/illustrations";
import { SOCIALS } from "@/lib/cattery-data";

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
  return (
    <PhoneFrame title="联系方式" backTo="/">
      <Section className="pt-2 text-center">
        <HeartPaw className="mx-auto h-12 w-12 text-violet/45" />
        <h1 className="mt-3 text-[20px] font-bold text-heading">在这些地方找到星月</h1>
        <p className="mx-auto mt-2 max-w-[17rem] text-[12.5px] leading-[1.9] text-foreground">
          点击即可复制账号，欢迎来聊聊猫、看看小猫日常。
        </p>
      </Section>

      <Section className="mt-6 space-y-2.5">
        {SOCIALS.map((s) => (
          <CopyText key={s.label} label={s.label} value={s.value} />
        ))}
      </Section>

      <Section className="mb-10 mt-8">
        <Card className="p-4">
          <p className="text-center text-[12px] leading-[1.95] text-muted-foreground">
            咨询前建议先读完接猫流程、填写选猫问卷，方便我们更好地了解你的需求。
          </p>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
