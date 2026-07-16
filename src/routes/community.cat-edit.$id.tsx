import { useState } from "react";
import {
  createFileRoute,
  useParams,
  useNavigate,
  notFound,
} from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { actions, useCommunity, type CommunityCat } from "@/lib/community-store";

export const Route = createFileRoute("/community/cat-edit/$id")({
  head: () => ({ meta: [{ title: "编辑猫咪 — 猫友圈" }] }),
  component: CatEdit,
});

function CatEdit() {
  const { id } = useParams({ from: "/community/cat-edit/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const existing = useCommunity((s) => s.cats.find((c) => c.id === id));
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);

  if (!isNew && !existing) throw notFound();

  const [form, setForm] = useState<Omit<CommunityCat, "id" | "ownerId">>({
    name: existing?.name ?? "",
    gender: existing?.gender ?? "弟弟",
    birthday: existing?.birthday ?? "",
    joinDate: existing?.joinDate ?? "",
    color: existing?.color ?? "",
    personality: existing?.personality ?? "",
    note: existing?.note ?? "",
  });

  if (role !== "parent" || !currentUserId) {
    return (
      <PhoneFrame title="编辑猫咪" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          请先开通家长身份。
        </Section>
      </PhoneFrame>
    );
  }

  const save = () => {
    if (!form.name.trim()) {
      alert("请填写猫咪名字");
      return;
    }
    if (isNew) {
      actions.addCat({ ...form, ownerId: currentUserId });
    } else if (existing) {
      actions.updateCat(existing.id, form);
    }
    navigate({ to: "/community/my-cats" });
  };

  return (
    <PhoneFrame title={isNew ? "添加猫咪" : "编辑猫咪"} showBack>
      <Section className="space-y-4 py-4 pb-8">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">头像</p>
          <Placeholder
            label="示例图片（点击上传，待接入）"
            ratio="aspect-[4/3]"
            rounded="rounded-2xl"
          />
        </div>

        <Field label="名字" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如：呼呼"
            className={inputCls}
          />
        </Field>

        <Field label="性别">
          <div className="flex gap-2">
            {(["弟弟", "妹妹"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setForm({ ...form, gender: g })}
                className={`pressable flex-1 rounded-full py-2 text-[13px] ${
                  form.gender === g
                    ? "bg-violet text-white shadow-card"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>

        <Field label="毛色">
          <input
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            placeholder="例如：棕虎斑加白"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="生日">
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="到家日期">
            <input
              type="date"
              value={form.joinDate}
              onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="性格">
          <textarea
            value={form.personality}
            onChange={(e) => setForm({ ...form, personality: e.target.value })}
            placeholder="用一两句话形容它～"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>

        <Field label="给自家猫的一句话（可选）">
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="例如：希望你健康快乐地陪我们很久很久。"
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </Field>

        <button
          onClick={save}
          className="pressable w-full rounded-full bg-violet py-3 text-[15px] font-semibold text-white shadow-card"
        >
          保存
        </button>
      </Section>
    </PhoneFrame>
  );
}

const inputCls =
  "w-full rounded-2xl border border-border bg-card px-3.5 py-2.5 text-[14px] outline-none focus:border-primary";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-heading">
        {label}
        {required && <span className="ml-0.5 text-wine">*</span>}
      </span>
      {children}
    </label>
  );
}
