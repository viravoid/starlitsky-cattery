import { StructuredListEditor } from "./StructuredListEditor";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  onChange: (patch: JsonRecord) => void;
}

export function ProcessContentEditor({ content, onChange }: Props) {
  const text = (key: string) => typeof content[key] === "string" ? content[key] as string : "";
  const section = (
    title: string,
    introKey: string | null,
    listKey: string,
    fields: Array<{ key: string; label: string; multiline?: boolean }>,
    addLabel: string,
    newItem: () => JsonRecord,
  ) => <section className="home-editor-section" key={listKey}>
    <div className="section-heading"><div><h4>{title}</h4></div></div>
    {introKey ? <label>开头说明<textarea rows={4} value={text(introKey)} onChange={(event) => onChange({ [introKey]: event.target.value })} /></label> : null}
    <StructuredListEditor addLabel={addLabel} fields={fields} items={records(content[listKey])} newItem={newItem} onChange={(items) => onChange({ [listKey]: items })} />
  </section>;

  return <div className="home-editor">
    {section("价格区间", "pricingIntro", "priceCards", [
      { key: "label", label: "名称" }, { key: "value", label: "价格" }, { key: "note", label: "说明", multiline: true },
    ], "新增价格卡", () => ({ id: `process-price-${crypto.randomUUID()}`, label: "新价格类型", value: "价格待定", note: "" }))}
    {section("繁育权", "breedingIntro", "breedingCards", [
      { key: "label", label: "名称" }, { key: "value", label: "价格" },
    ], "新增繁育权卡", () => ({ id: `process-breeding-${crypto.randomUUID()}`, label: "新繁育权类型", value: "价格待定" }))}
    {section("老家长福利", "returningFamiliesIntro", "returningBenefits", [
      { key: "label", label: "名称" }, { key: "value", label: "内容", multiline: true },
    ], "新增福利", () => ({ id: `process-returning-${crypto.randomUUID()}`, label: "新福利", value: "福利内容" }))}
    {section("购买流程", null, "steps", [
      { key: "title", label: "步骤标题" }, { key: "description", label: "步骤说明", multiline: true },
    ], "新增步骤", () => ({ id: `process-step-${crypto.randomUUID()}`, title: "新流程步骤", description: "" }))}
    {section("新家礼包", null, "welcomeKitItems", [
      { key: "text", label: "标签文字", multiline: true },
    ], "新增礼包标签", () => ({ id: `process-kit-${crypto.randomUUID()}`, text: "新礼包内容" }))}
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>礼包说明与合同提示</h4></div></div>
      <label>新家礼包补充说明<textarea rows={4} value={text("welcomeKitNote")} onChange={(event) => onChange({ welcomeKitNote: event.target.value })} /></label>
      <label>页面底部合同提示<textarea rows={4} value={text("contractNotice")} onChange={(event) => onChange({ contractNotice: event.target.value })} /></label>
    </section>
  </div>;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map((item) => item && typeof item === "object" && !Array.isArray(item) ? item as JsonRecord : {})
    : [];
}
