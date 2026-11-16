import type { MediaAssetData } from "@starlitsky/shared";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  images: MediaAssetData[];
  onChange: (patch: JsonRecord) => void;
  onImageUpload: (file: File, slideId: string) => Promise<void>;
}

export function HomeContentEditor({ content, images, onChange, onImageUpload }: Props) {
  const hero = record(content.hero);
  const intro = record(content.intro);
  const catsPreview = record(content.catsPreview);
  const groups = Array.isArray(content.groups) ? content.groups.map(record) : [];
  const entries = record(content.entries);
  const slides = Array.isArray(hero.slides) ? hero.slides.map(record) : [];
  const imageOptions = images.filter((image) => image.kind === "image" && image.status === "active");

  const changeHero = (patch: JsonRecord) => onChange({ hero: { ...hero, ...patch } });
  const changeIntro = (patch: JsonRecord) => onChange({ intro: { ...intro, ...patch } });
  const changeCats = (patch: JsonRecord) => onChange({ catsPreview: { ...catsPreview, ...patch } });
  const changeSlide = (index: number, patch: JsonRecord) =>
    changeHero({ slides: slides.map((slide, itemIndex) => itemIndex === index ? { ...slide, ...patch } : slide) });
  const changeGroup = (index: number, patch: JsonRecord) =>
    onChange({ groups: groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group) });
  const changeEntry = (id: string, patch: JsonRecord) =>
    onChange({ entries: { ...entries, [id]: { ...record(entries[id]), ...patch } } });

  return (
    <div className="home-editor">
      <section className="home-editor-section">
        <div className="section-heading"><div><h4>首页头图与轮播</h4><p className="muted compact">图片上传后还需保存页面，才会应用到小程序。</p></div></div>
        <div className="form-grid">
          <label>主标题<input value={string(hero.title)} onChange={(event) => changeHero({ title: event.target.value })} /></label>
          <label>英文副标题<input value={string(hero.subtitle)} onChange={(event) => changeHero({ subtitle: event.target.value })} /></label>
        </div>
        <div className="home-slide-list">
          {slides.map((slide, index) => {
            const selectedImage = imageOptions.find((image) => image.id === slide.imageId);
            return (
              <div className="home-slide-row" key={string(slide.id) || index}>
                <div className="home-slide-preview">
                  {selectedImage ? <img src={selectedImage.thumbnailUrl || selectedImage.sourceUrl} alt={string(slide.label) || `轮播图 ${index + 1}`} /> : <span>暂无图片</span>}
                </div>
                <div className="form-stack">
                  <label>轮播图说明<input value={string(slide.label)} onChange={(event) => changeSlide(index, { label: event.target.value })} /></label>
                  <label>选择已上传图片
                    <select value={string(slide.imageId)} onChange={(event) => changeSlide(index, { imageId: event.target.value })}>
                      <option value="">未设置图片</option>
                      {imageOptions.map((image) => <option key={image.id} value={image.id}>{image.title || image.id}</option>)}
                    </select>
                  </label>
                  <label>上传新图片
                    <input accept="image/*" type="file" onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void onImageUpload(file, string(slide.id));
                    }} />
                  </label>
                  <div className="form-actions">
                    <button className="secondary-button small-button" type="button" disabled={index === 0} onClick={() => changeHero({ slides: move(slides, index, index - 1) })}>上移</button>
                    <button className="secondary-button small-button" type="button" disabled={index === slides.length - 1} onClick={() => changeHero({ slides: move(slides, index, index + 1) })}>下移</button>
                    <button className="danger-button small-button" type="button" disabled={slides.length <= 1} onClick={() => {
                      if (window.confirm("确定删除这张轮播图吗？")) changeHero({ slides: slides.filter((_, itemIndex) => itemIndex !== index) });
                    }}>删除</button>
                  </div>
                </div>
              </div>
            );
          })}
          <button className="secondary-button" type="button" onClick={() => changeHero({ slides: [...slides, { id: `hero-${crypto.randomUUID()}`, label: `首页轮播图 ${slides.length + 1}` }] })}>新增轮播图</button>
        </div>
      </section>

      <section className="home-editor-section">
        <div className="section-heading"><div><h4>首页介绍</h4></div></div>
        <div className="form-grid">
          <label>前缀<input value={string(intro.eyebrowPrefix)} onChange={(event) => changeIntro({ eyebrowPrefix: event.target.value })} /></label>
          <label>成立与注册信息<input value={string(intro.fixedMeta)} onChange={(event) => changeIntro({ fixedMeta: event.target.value })} /></label>
        </div>
        <label>介绍正文<textarea rows={5} value={string(intro.body)} onChange={(event) => changeIntro({ body: event.target.value })} /></label>
      </section>

      <section className="home-editor-section">
        <div className="section-heading"><div><h4>分组与页面入口</h4><p className="muted compact">入口地址由页面配置决定；在这里编辑展示文案和顺序。</p></div></div>
        {groups.map((group, groupIndex) => {
          const order = Array.isArray(group.entryOrder) ? group.entryOrder.filter((id): id is string => typeof id === "string") : [];
          return <div className="home-group-card" key={string(group.id) || groupIndex}>
            <div className="form-grid">
              <label>分组中文名<input value={string(group.cn)} onChange={(event) => changeGroup(groupIndex, { cn: event.target.value })} /></label>
              <label>分组英文名<input value={string(group.en)} onChange={(event) => changeGroup(groupIndex, { en: event.target.value })} /></label>
            </div>
            <label>分组介绍<textarea rows={3} value={string(group.lead)} onChange={(event) => changeGroup(groupIndex, { lead: event.target.value })} /></label>
            {order.map((id, entryIndex) => {
              const entry = record(entries[id]);
              return <div className="home-entry-row" key={id}>
                <div className="form-grid">
                  <label>入口标题<input value={string(entry.title)} onChange={(event) => changeEntry(id, { title: event.target.value })} /></label>
                  <label>入口说明<textarea rows={2} value={string(entry.desc)} onChange={(event) => changeEntry(id, { desc: event.target.value })} /></label>
                </div>
                <div className="form-actions">
                  <button className="secondary-button small-button" type="button" disabled={entryIndex === 0} onClick={() => changeGroup(groupIndex, { entryOrder: move(order, entryIndex, entryIndex - 1) })}>上移</button>
                  <button className="secondary-button small-button" type="button" disabled={entryIndex === order.length - 1} onClick={() => changeGroup(groupIndex, { entryOrder: move(order, entryIndex, entryIndex + 1) })}>下移</button>
                </div>
              </div>;
            })}
          </div>;
        })}
      </section>

      <section className="home-editor-section">
        <div className="section-heading"><div><h4>我们的猫入口</h4></div></div>
        <div className="form-grid">
          <label>眉题<input value={string(catsPreview.eyebrow)} onChange={(event) => changeCats({ eyebrow: event.target.value })} /></label>
          <label>标题<input value={string(catsPreview.title)} onChange={(event) => changeCats({ title: event.target.value })} /></label>
        </div>
        <label>介绍<textarea rows={3} value={string(catsPreview.description)} onChange={(event) => changeCats({ description: event.target.value })} /></label>
        <label>按钮文案<input value={string(catsPreview.buttonText)} onChange={(event) => changeCats({ buttonText: event.target.value })} /></label>
      </section>
    </div>
  );
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
