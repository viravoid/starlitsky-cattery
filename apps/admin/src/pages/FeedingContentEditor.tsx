import type { MediaAssetData } from "@starlitsky/shared";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  images: MediaAssetData[];
  onChange: (patch: JsonRecord) => void;
  onImageUpload: (file: File, moduleId: string, slotId: string) => Promise<void>;
}

export function FeedingContentEditor({ content, images, onChange, onImageUpload }: Props) {
  const modules = Array.isArray(content.modules) ? content.modules.map(record) : [];
  const ratio = record(content.imageAspectRatio);
  const imageOptions = images.filter((item) => item.kind === "image" && item.status === "active");
  const changeModule = (index: number, patch: JsonRecord) =>
    onChange({ modules: modules.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });

  return <div className="home-editor">
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>开头说明与照片比例</h4></div></div>
      <label>说明正文<textarea rows={5} value={string(content.intro)} onChange={(event) => onChange({ intro: event.target.value })} /></label>
      <div className="form-grid">
        <label>照片比例：宽<input type="number" min="1" max="32" step="0.01" value={positive(ratio.width, 4)} onChange={(event) => onChange({ imageAspectRatio: { ...ratio, width: Number(event.target.value) } })} /></label>
        <label>照片比例：高<input type="number" min="1" max="32" step="0.01" value={positive(ratio.height, 3)} onChange={(event) => onChange({ imageAspectRatio: { ...ratio, height: Number(event.target.value) } })} /></label>
      </div>
      <div className="form-actions">
        {[[4, 3], [16, 10], [1, 1]].map(([width, height]) =>
          <button className="secondary-button small-button" key={`${width}:${height}`} type="button" onClick={() => onChange({ imageAspectRatio: { width, height } })}>{width}:{height}</button>,
        )}
      </div>
    </section>

    <section className="home-editor-section">
      <div className="section-heading"><div><h4>喂养模块与照片</h4><p className="muted compact">模块结构固定；照片上传后请保存页面。</p></div></div>
      {modules.map((module, moduleIndex) => {
        const slots = list(module.images);
        const changeImages = (nextImages: JsonRecord[]) => changeModule(moduleIndex, { images: nextImages });
        return <details className="environment-section-editor" key={string(module.id) || moduleIndex}>
          <summary>{string(module.title) || `喂养模块 ${moduleIndex + 1}`} · {slots.length} 张照片</summary>
          <div className="form-stack">
            <label>模块标题<input value={string(module.title)} onChange={(event) => changeModule(moduleIndex, { title: event.target.value })} /></label>
            <label>模块正文<textarea rows={7} value={string(module.body)} onChange={(event) => changeModule(moduleIndex, { body: event.target.value })} /></label>
            {slots.map((slot, slotIndex) => {
              const selectedImage = imageOptions.find((item) => item.id === slot.imageId);
              const focal = record(slot.focalPoint);
              const x = percent(focal.x);
              const y = percent(focal.y);
              const setSlot = (patch: JsonRecord) => changeImages(slots.map((item, itemIndex) => itemIndex === slotIndex ? { ...item, ...patch } : item));
              return <div className="home-slide-row" key={string(slot.id) || slotIndex}>
                <div className="environment-photo-preview" style={{ aspectRatio: `${positive(ratio.width, 4)} / ${positive(ratio.height, 3)}` }}>
                  {selectedImage ? <img src={selectedImage.thumbnailUrl || selectedImage.sourceUrl} alt={`${string(module.title)}照片 ${slotIndex + 1}`} style={{ objectPosition: `${x}% ${y}%` }} /> : <span>暂无图片</span>}
                </div>
                <div className="form-stack">
                  <label>选择已上传照片
                    <select value={string(slot.imageId)} onChange={(event) => setSlot({ imageId: event.target.value })}>
                      <option value="">未设置图片</option>
                      {imageOptions.map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
                    </select>
                  </label>
                  <label>上传替换照片<input type="file" accept="image/*" onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void onImageUpload(file, string(module.id), string(slot.id));
                  }} /></label>
                  <div className="form-grid">
                    <label>横向焦点 {x}%<input type="range" min="0" max="100" value={x} onChange={(event) => setSlot({ focalPoint: { ...focal, x: Number(event.target.value), y } })} /></label>
                    <label>纵向焦点 {y}%<input type="range" min="0" max="100" value={y} onChange={(event) => setSlot({ focalPoint: { ...focal, x, y: Number(event.target.value) } })} /></label>
                  </div>
                  <div className="form-actions">
                    <button className="secondary-button small-button" type="button" onClick={() => setSlot({ focalPoint: { x: 50, y: 50 } })}>恢复居中</button>
                    <button className="secondary-button small-button" type="button" disabled={slotIndex === 0} onClick={() => changeImages(move(slots, slotIndex, slotIndex - 1))}>上移</button>
                    <button className="secondary-button small-button" type="button" disabled={slotIndex === slots.length - 1} onClick={() => changeImages(move(slots, slotIndex, slotIndex + 1))}>下移</button>
                    <button className="danger-button small-button" type="button" onClick={() => {
                      if (window.confirm("确定从模块移除照片吗？")) changeImages(slots.filter((_, itemIndex) => itemIndex !== slotIndex));
                    }}>移除</button>
                  </div>
                </div>
              </div>;
            })}
            <button className="secondary-button" type="button" onClick={() => changeImages([...slots, { id: `feeding-image-${crypto.randomUUID()}`, focalPoint: { x: 50, y: 50 } }])}>新增照片位</button>
          </div>
        </details>;
      })}
    </section>
  </div>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positive(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function percent(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 50;
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
