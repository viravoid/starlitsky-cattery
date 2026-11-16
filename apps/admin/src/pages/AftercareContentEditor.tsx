import type { MediaAssetData } from "@starlitsky/shared";
import { StructuredListEditor } from "./StructuredListEditor";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  media: MediaAssetData[];
  onChange: (patch: JsonRecord) => void;
  onContractUpload: (file: File) => Promise<void>;
}

export function AftercareContentEditor({ content, media, onChange, onContractUpload }: Props) {
  const contractFile = record(content.contractFile);
  const contractId = string(contractFile.assetId);
  const contractOptions = media.filter((item) =>
    item.status === "active" &&
    (item.kind === "document" || item.bindings.some((binding) => binding.usage === "contract")),
  );
  const selectedContract = contractOptions.find((item) => item.id === contractId);
  const updateContract = (patch: JsonRecord) => onChange({ contractFile: { ...contractFile, ...patch } });

  return <div className="home-editor">
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>繁育与售后承诺</h4></div></div>
      <StructuredListEditor
        addLabel="新增承诺"
        fields={[{ key: "text", label: "承诺文字", multiline: true }]}
        items={records(content.promises)}
        newItem={() => ({ id: `aftercare-promise-${crypto.randomUUID()}`, text: "新售后承诺" })}
        onChange={(promises) => onChange({ promises })}
      />
    </section>
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>去新家前项目</h4></div></div>
      <StructuredListEditor
        addLabel="新增项目"
        fields={[{ key: "text", label: "项目文字", multiline: true }]}
        items={records(content.healthItems)}
        newItem={() => ({ id: `aftercare-health-${crypto.randomUUID()}`, text: "新检查项目" })}
        onChange={(healthItems) => onChange({ healthItems })}
      />
    </section>
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>合同文件</h4><p className="muted compact">PDF 或图片上传后，请保存页面使小程序显示新文件。</p></div></div>
      <label>文件标题<input value={string(contractFile.title)} onChange={(event) => updateContract({ title: event.target.value })} /></label>
      <label>选择当前页面已上传的合同
        <select value={selectedContract ? contractId : ""} onChange={(event) => {
          const selected = contractOptions.find((item) => item.id === event.target.value);
          updateContract({ assetId: selected?.id || "", fileName: selected?.title || "", mimeType: selected?.mimeType || "" });
        }}>
          <option value="">尚未选择</option>
          {contractOptions.map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
        </select>
      </label>
      <p className="muted compact">{selectedContract ? `${selectedContract.title || selectedContract.id} · ${selectedContract.mimeType || "未知格式"}` : "当前没有可用合同文件。"}</p>
      <label>上传或替换合同<input type="file" accept="application/pdf,image/*" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void onContractUpload(file);
      }} /></label>
      <button className="secondary-button small-button" type="button" disabled={!contractId} onClick={() => updateContract({ assetId: "", fileName: "", mimeType: "" })}>移除当前文件</button>
    </section>
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>底部合同提示</h4></div></div>
      <label>合同提示<textarea rows={5} value={string(content.contractNotice)} onChange={(event) => onChange({ contractNotice: event.target.value })} /></label>
    </section>
  </div>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
