import { PhoneFrame } from "./PhoneFrame";
import { Section, SectionTitle, Card } from "./ui";
import { ShieldIcon, PawIcon, CrossIcon, MoonIcon } from "./icons";
import type { AftercareContent } from "@/lib/aftercare-content";

export function AftercareView({
  content,
  preview = false,
}: {
  content: AftercareContent;
  preview?: boolean;
}) {
  const promises = content.promises.filter((item) => item.text.trim());
  const healthItems = content.healthItems.filter((item) => item.text.trim());
  const showContractNotice = Boolean(content.contractNotice.trim());

  return (
    <PhoneFrame
      title="售后保障"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      {promises.length > 0 && (
        <Section className="pt-1">
          <SectionTitle
            cn="繁育与售后承诺"
            en="Our Promise"
            icon={<ShieldIcon className="h-5 w-5" />}
          />
          <div className="space-y-2.5">
            {promises.map((promise) => (
              <Card key={promise.id} className="flex items-start gap-3 p-3.5">
                <PawIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet/70" />
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-card-foreground">
                  {promise.text}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {healthItems.length > 0 && (
        <Section className={promises.length > 0 ? "mt-7" : "pt-1"}>
          <SectionTitle
            cn="去新家前项目"
            en="Health Check"
            icon={<CrossIcon className="h-5 w-5" />}
          />
          <Card className="p-4">
            <ul className="flex flex-col gap-3">
              {healthItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-card-foreground"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="whitespace-pre-line">{item.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      {showContractNotice && (
        <Section className="mb-10 mt-6">
          <div className="flex items-start gap-2 rounded-2xl bg-sunny/40 p-3.5">
            <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#b48725]" />
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-[#b48725]">
              {content.contractNotice}
            </p>
          </div>
        </Section>
      )}
    </PhoneFrame>
  );
}
