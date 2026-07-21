import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { HeartPaw } from "@/components/mobile/illustrations";
import type { ContactContent } from "@/lib/contact-content";

export function ContactView({
  content,
  preview = false,
}: {
  content: ContactContent;
  preview?: boolean;
}) {
  const introduction = content.introduction.trim();
  const footerNotice = content.footerNotice.trim();
  const visibleAccounts = content.accounts
    .map((account) => ({
      ...account,
      label: account.label.trim(),
      value: account.value.trim(),
    }))
    .filter((account) => account.value);

  return (
    <PhoneFrame
      title="联系方式"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pt-2 text-center">
        <HeartPaw className="mx-auto h-12 w-12 text-violet/45" />
        <h1 className="mt-3 text-[20px] font-bold text-heading">在这些地方找到星月</h1>
        {introduction && (
          <p className="mx-auto mt-2 max-w-[17rem] text-[12.5px] leading-[1.9] text-foreground">
            {introduction}
          </p>
        )}
      </Section>

      {visibleAccounts.length > 0 && (
        <Section className="mt-6 space-y-2.5">
          {visibleAccounts.map((account) => (
            <CopyText key={account.id} label={account.label || undefined} value={account.value} />
          ))}
        </Section>
      )}

      {footerNotice && (
        <Section className="mb-10 mt-8">
          <Card className="p-4">
            <p className="text-center text-[12px] leading-[1.95] text-muted-foreground">
              {footerNotice}
            </p>
          </Card>
        </Section>
      )}
    </PhoneFrame>
  );
}
