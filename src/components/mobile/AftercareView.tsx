import { useEffect, useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { Section, SectionTitle, Card } from "./ui";
import { ShieldIcon, CrossIcon, MoonIcon, DnaIcon, HeartIcon, CatIcon } from "./icons";
import type { AftercareContent } from "@/lib/aftercare-content";
import { getSitePageAssetBlob } from "@/lib/site-page-storage";

const PROMISE_ICONS = [DnaIcon, HeartIcon, CatIcon, ShieldIcon];

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
  const contractTitle = content.contractFile.title.trim() || "购猫合同";
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const hasContractAsset = Boolean(content.contractFile.assetId);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      if (!content.contractFile.assetId) {
        if (active) setContractUrl(null);
        return;
      }
      const blob = await getSitePageAssetBlob(content.contractFile.assetId);
      if (!blob || !active) {
        if (active) setContractUrl(null);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      if (active) setContractUrl(objectUrl);
    }

    void load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [content.contractFile.assetId]);

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
            {promises.map((promise, index) => {
              const PromiseIcon = PROMISE_ICONS[index % PROMISE_ICONS.length];
              return (
                <Card key={promise.id} className="flex items-start gap-3 p-3.5">
                  <PromiseIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet/70" />
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-card-foreground">
                    {promise.text}
                  </p>
                </Card>
              );
            })}
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

      <Section className={`${healthItems.length > 0 || promises.length > 0 ? "mt-7" : "pt-1"}`}>
        <SectionTitle cn="合同文件" en="Contract" icon={<MoonIcon className="h-5 w-5" />} />
        <Card className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-heading">{contractTitle}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {content.contractFile.fileName
                  ? content.contractFile.fileName
                  : "后台上传后，这里会显示可查看 / 下载的合同文件。"}
              </p>
            </div>
            <span className="rounded-full bg-sunny/45 px-2.5 py-1 text-[11px] font-semibold text-[#b48725]">
              {content.contractFile.mimeType?.includes("pdf")
                ? "PDF"
                : hasContractAsset
                  ? "文件"
                  : "待上传"}
            </span>
          </div>
          {contractUrl ? (
            <div className="flex gap-2">
              <a
                href={contractUrl}
                target="_blank"
                rel="noreferrer"
                className="pressable flex-1 rounded-full border border-primary bg-card py-2.5 text-center text-[13px] font-semibold text-primary shadow-card"
              >
                查看
              </a>
              <a
                href={contractUrl}
                download={content.contractFile.fileName ?? contractTitle}
                className="pressable flex-1 rounded-full bg-primary py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
              >
                下载
              </a>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
              当前还没有上传合同文件。
            </div>
          )}
        </Card>
      </Section>

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
