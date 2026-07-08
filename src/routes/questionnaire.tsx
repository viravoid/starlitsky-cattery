import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { PaperIcon, CheckIcon, HeartIcon } from "@/components/mobile/icons";
import { WECHAT_ID } from "@/lib/cattery-data";

export const Route = createFileRoute("/questionnaire")({
  component: Questionnaire,
});

function Field({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-heading">{label}</span>
      <input
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[14px] text-card-foreground outline-none placeholder:text-warm focus:border-primary"
      />
    </label>
  );
}

function ChoiceField({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  const [sel, setSel] = useState<string>("");
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-heading">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setSel(o)}
            className={`pressable rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
              sel === o
                ? "bg-primary text-primary-foreground shadow-card"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Questionnaire() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <PhoneFrame activeTab="questionnaire" showTabBar>
        <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-sky/25">
            <CheckIcon className="h-10 w-10 text-violet" />
          </span>
          <h2 className="mt-5 text-[18px] font-semibold text-heading">
            问卷已提交，感谢你的认真填写
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground">
            如需进一步沟通，可以复制微信号添加咨询：
          </p>
          <div className="mt-4 w-full max-w-xs">
            <CopyText label="微信号" value={WECHAT_ID} />
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="pressable mt-6 text-[13px] font-semibold text-violet"
          >
            返回问卷
          </button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame
      activeTab="questionnaire"
      showTabBar
      bottomBar={
        <div className="border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <button
            onClick={() => setSubmitted(true)}
            className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-semibold text-white shadow-card"
          >
            <PaperIcon className="h-5 w-5" /> 提交问卷
          </button>
        </div>
      }
    >
      <Section className="pb-4 pt-3">
        <div className="mb-4 flex items-center gap-2">
          <HeartIcon className="h-6 w-6 text-violet" />
          <div>
            <h1 className="text-[19px] font-semibold text-heading">选猫问卷</h1>
            <p className="text-[12px] text-muted-foreground">
              慢慢填就好，让我们更了解你和未来的小猫～
            </p>
          </div>
        </div>

        <Card className="space-y-4 p-4">
          <Field label="称呼" placeholder="怎么称呼你呢" />
          <Field label="微信号" placeholder="方便我们添加沟通" />
          <Field label="所在城市" placeholder="例如：西安" />
          <ChoiceField label="是否第一次养猫" options={["是", "否"]} />
          <ChoiceField label="是否了解缅因猫" options={["了解", "了解一些", "还不了解"]} />
          <ChoiceField label="是否已有猫" options={["有", "没有"]} />
          <ChoiceField label="是否接受绝育后接猫" options={["接受", "再想想"]} />
          <Field label="预算区间" placeholder="例如：15000 – 20000" />
          <Field label="喜欢的颜色" placeholder="例如：银虎斑 / 玳瑁" />
          <ChoiceField label="喜欢的性别" options={["弟弟", "妹妹", "都可以"]} />
          <Field label="喜欢的性格" placeholder="例如：安静粘人 / 活泼" />
          <ChoiceField label="是否接受排队" options={["接受", "希望现猫"]} />
          <Field label="预计接猫时间" placeholder="例如：3 个月内" />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-heading">
              想补充说明的问题
            </span>
            <textarea
              rows={3}
              placeholder="任何想告诉我们的都可以写在这里"
              className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] text-card-foreground outline-none placeholder:text-warm focus:border-primary"
            />
          </label>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
