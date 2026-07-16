import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder, Pill } from "@/components/mobile/ui";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/mobile/icons";
import { useCommunity, actions } from "@/lib/community-store";

export const Route = createFileRoute("/community/my-cats")({
  head: () => ({ meta: [{ title: "我的猫咪 — 猫友圈" }] }),
  beforeLoad: () => {
    // no auth check on server; simple client gate handled in component
  },
  component: MyCats,
});

function MyCats() {
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const cats = useCommunity((s) =>
    s.cats.filter((c) => c.ownerId === currentUserId),
  );

  if (role !== "parent") {
    return (
      <PhoneFrame title="我的猫咪" showBack>
        <Section className="py-10 text-center">
          <p className="text-[14px] text-muted-foreground">
            此功能仅对已开通身份的星月家长开放。
          </p>
          <Link
            to="/community/parent-onboard"
            className="pressable mt-4 inline-flex rounded-full bg-violet px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            开通家长身份
          </Link>
        </Section>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame title="我的猫咪" showBack>
      <Section className="space-y-3 py-4 pb-8">
        <p className="text-[12.5px] leading-relaxed text-warm">
          添加你的猫咪，可以在发布动态时关联它，也能生成一条专属的成长时光轴。
        </p>

        {cats.length === 0 && (
          <div className="soft-card text-center text-[13px] text-muted-foreground">
            还没有添加猫咪。
          </div>
        )}

        {cats.map((c) => (
          <div key={c.id} className="soft-card flex gap-3">
            <Placeholder
              label="头像"
              ratio="aspect-square"
              rounded="rounded-xl"
              compact
              className="h-20 w-20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-[15px] font-semibold text-heading">{c.name}</h3>
                <Pill tone={c.gender === "妹妹" ? "warm" : "sky"}>{c.gender}</Pill>
              </div>
              <p className="mt-1 text-[12px] text-warm">{c.color}</p>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-card-foreground">
                {c.personality}
              </p>
              <div className="mt-2 flex gap-2">
                <Link
                  to="/community/cat-edit/$id"
                  params={{ id: c.id }}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11.5px] font-medium text-heading"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  编辑
                </Link>
                <Link
                  to="/community/cat/$id"
                  params={{ id: c.id }}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11.5px] font-medium text-heading"
                >
                  时光轴
                </Link>
                <button
                  onClick={() => confirm(`删除 ${c.name}？`) && actions.deleteCat(c.id)}
                  className="pressable inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-medium text-wine"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}

        <Link
          to="/community/cat-edit/$id"
          params={{ id: "new" }}
          className="pressable flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border bg-card/60 py-4 text-[13px] font-semibold text-violet"
        >
          <PlusIcon className="h-4 w-4" />
          添加一只猫咪
        </Link>
      </Section>
    </PhoneFrame>
  );
}

void redirect;
