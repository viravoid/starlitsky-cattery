import type { MediaAssetData } from "@starlitsky/shared";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  images: MediaAssetData[];
  onChange: (patch: JsonRecord) => void;
  onImageUpload: (file: File, roomId: string, slotId: string) => Promise<void>;
}

export function EnvironmentContentEditor({ content, images, onChange, onImageUpload }: Props) {
  const sections = Array.isArray(content.sections) ? content.sections.map(record) : [];
  const ratio = record(content.imageAspectRatio);
  const imageOptions = images.filter((item) => item.kind === "image" && item.status === "active");
  const changeSection = (index: number, patch: JsonRecord) =>
    onChange({ sections: sections.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section) });
  const changeRooms = (sectionIndex: number, rooms: JsonRecord[]) => {
    const imageIds = new Set(rooms.flatMap((room) => imageList(room)).map((item) => string(item.imageId)));
    const coverImageId = string(sections[sectionIndex].coverImageId);
    changeSection(sectionIndex, { rooms, coverImageId: imageIds.has(coverImageId) ? coverImageId : "" });
  };
  const changeRoom = (sectionIndex: number, roomIndex: number, patch: JsonRecord) => {
    const rooms = roomList(sections[sectionIndex]);
    changeRooms(sectionIndex, rooms.map((room, itemIndex) => itemIndex === roomIndex ? { ...room, ...patch } : room));
  };
  const changeImages = (sectionIndex: number, roomIndex: number, nextImages: JsonRecord[]) =>
    changeRoom(sectionIndex, roomIndex, { images: nextImages });

  return <div className="home-editor">
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>开头说明与照片比例</h4></div></div>
      <label>页面说明<textarea rows={5} value={string(content.intro)} onChange={(event) => onChange({ intro: event.target.value })} /></label>
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
      <div className="section-heading"><div><h4>环境分区与房间照片</h4><p className="muted compact">逐个房间维护照片；图片上传后请保存页面。</p></div></div>
      {sections.map((section, sectionIndex) => {
        const rooms = roomList(section);
        return <details className="environment-section-editor" key={string(section.id) || sectionIndex}>
          <summary>{string(section.title) || `环境分区 ${sectionIndex + 1}`} · {rooms.length} 个房间</summary>
          <div className="form-stack">
            <div className="form-grid">
              <label>分区名称<input value={string(section.title)} onChange={(event) => changeSection(sectionIndex, { title: event.target.value })} /></label>
              <label>区域信息<input value={string(section.meta)} onChange={(event) => changeSection(sectionIndex, { meta: event.target.value })} /></label>
            </div>
            <label>总览摘要<textarea rows={3} value={string(section.summary)} onChange={(event) => changeSection(sectionIndex, { summary: event.target.value })} /></label>
            {rooms.map((room, roomIndex) => {
              const roomImages = imageList(room);
              return <details className="environment-room-editor" key={string(room.id) || roomIndex}>
                <summary>{string(room.title) || `房间 ${roomIndex + 1}`} · {roomImages.length} 张照片</summary>
                <div className="form-stack">
                  <div className="form-grid">
                    <label>房间名称<input value={string(room.title)} onChange={(event) => changeRoom(sectionIndex, roomIndex, { title: event.target.value })} /></label>
                    <label>房间说明<textarea rows={2} value={string(room.description)} onChange={(event) => changeRoom(sectionIndex, roomIndex, { description: event.target.value })} /></label>
                  </div>
                  {roomImages.map((slot, imageIndex) => {
                    const selectedImage = imageOptions.find((item) => item.id === slot.imageId);
                    const focal = record(slot.focalPoint);
                    const x = percent(focal.x);
                    const y = percent(focal.y);
                    const setSlot = (patch: JsonRecord) => changeImages(sectionIndex, roomIndex, roomImages.map((item, itemIndex) => itemIndex === imageIndex ? { ...item, ...patch } : item));
                    return <div className="home-slide-row" key={string(slot.id) || imageIndex}>
                      <div className="environment-photo-preview" style={{ aspectRatio: `${positive(ratio.width, 4)} / ${positive(ratio.height, 3)}` }}>
                        {selectedImage ? <img src={selectedImage.thumbnailUrl || selectedImage.sourceUrl} alt={`${string(room.title)}照片 ${imageIndex + 1}`} style={{ objectPosition: `${x}% ${y}%` }} /> : <span>暂无图片</span>}
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
                          if (file) void onImageUpload(file, string(room.id), string(slot.id));
                        }} /></label>
                        <div className="form-grid">
                          <label>横向焦点 {x}%<input type="range" min="0" max="100" value={x} onChange={(event) => setSlot({ focalPoint: { ...focal, x: Number(event.target.value), y } })} /></label>
                          <label>纵向焦点 {y}%<input type="range" min="0" max="100" value={y} onChange={(event) => setSlot({ focalPoint: { ...focal, x, y: Number(event.target.value) } })} /></label>
                        </div>
                        <div className="form-actions">
                          <button className="secondary-button small-button" type="button" onClick={() => setSlot({ focalPoint: { x: 50, y: 50 } })}>恢复居中</button>
                          <button className="secondary-button small-button" type="button" disabled={imageIndex === 0} onClick={() => changeImages(sectionIndex, roomIndex, move(roomImages, imageIndex, imageIndex - 1))}>上移</button>
                          <button className="secondary-button small-button" type="button" disabled={imageIndex === roomImages.length - 1} onClick={() => changeImages(sectionIndex, roomIndex, move(roomImages, imageIndex, imageIndex + 1))}>下移</button>
                          <button className="danger-button small-button" type="button" onClick={() => {
                            if (window.confirm("确定从这个房间移除照片吗？")) changeImages(sectionIndex, roomIndex, roomImages.filter((_, itemIndex) => itemIndex !== imageIndex));
                          }}>移除</button>
                        </div>
                      </div>
                    </div>;
                  })}
                  <button className="secondary-button" type="button" onClick={() => changeImages(sectionIndex, roomIndex, [...roomImages, { id: `environment-image-${crypto.randomUUID()}`, focalPoint: { x: 50, y: 50 } }])}>新增照片位</button>
                  <div className="form-actions">
                    <button className="secondary-button small-button" type="button" disabled={roomIndex === 0} onClick={() => changeRooms(sectionIndex, move(rooms, roomIndex, roomIndex - 1))}>房间上移</button>
                    <button className="secondary-button small-button" type="button" disabled={roomIndex === rooms.length - 1} onClick={() => changeRooms(sectionIndex, move(rooms, roomIndex, roomIndex + 1))}>房间下移</button>
                    <button className="danger-button small-button" type="button" onClick={() => {
                      if (window.confirm("确定删除这个房间及其照片设置吗？")) changeRooms(sectionIndex, rooms.filter((_, itemIndex) => itemIndex !== roomIndex));
                    }}>删除房间</button>
                  </div>
                </div>
              </details>;
            })}
            <button className="secondary-button" type="button" onClick={() => changeRooms(sectionIndex, [...rooms, { id: `environment-room-${crypto.randomUUID()}`, title: "新房间", description: "", images: [] }])}>新增房间</button>
          </div>
        </details>;
      })}
    </section>
  </div>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function roomList(section: JsonRecord): JsonRecord[] {
  return Array.isArray(section.rooms) ? section.rooms.map(record) : [];
}

function imageList(room: JsonRecord): JsonRecord[] {
  return Array.isArray(room.images) ? room.images.map(record) : [];
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
