import { useEffect, useState } from "react";
import type { CatData } from "@starlitsky/shared";
import { listCats } from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  onChange: (patch: JsonRecord) => void;
}

export function BreedingPlanContentEditor({ content, onChange }: Props) {
  const groups = records(content.groups);
  const disclaimer = record(content.disclaimer);
  const [cats, setCats] = useState<CatData[]>([]);
  const [catError, setCatError] = useState("");
  const [catsLoading, setCatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all: CatData[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const result = await listCats({ page, pageSize: 100 });
          all.push(...result.items);
          totalPages = result.pagination.totalPages;
          page += 1;
        }
        if (!cancelled) setCats(all.filter((cat) => cat.breedingProfile && cat.visibility === "visible"));
      } catch (error) {
        if (!cancelled) setCatError(getErrorMessage(error));
      } finally {
        if (!cancelled) setCatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateGroups = (next: JsonRecord[]) => onChange({ groups: next });
  const updateGroup = (index: number, patch: JsonRecord) =>
    updateGroups(groups.map((group, itemIndex) => itemIndex === index ? { ...group, ...patch } : group));
  const maleCats = cats.filter((cat) => cat.gender === "male");
  const femaleCats = cats.filter((cat) => cat.gender === "female");

  return <div className="home-editor">
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>计划基本信息</h4></div></div>
      <label>计划周期<input value={string(content.period)} onChange={(event) => onChange({ period: event.target.value })} /></label>
      <label>开头介绍<textarea rows={4} value={string(content.introduction)} onChange={(event) => onChange({ introduction: event.target.value })} /></label>
      <label>花色说明<textarea rows={4} value={string(disclaimer.color)} onChange={(event) => onChange({ disclaimer: { ...disclaimer, color: event.target.value } })} /></label>
      <label>时间说明<textarea rows={4} value={string(disclaimer.schedule)} onChange={(event) => onChange({ disclaimer: { ...disclaimer, schedule: event.target.value } })} /></label>
    </section>
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>计划分组与繁育组合</h4><p className="muted compact">种猫选项来自正式猫咪档案；组合保存的是稳定的公开标识。</p></div></div>
      {catsLoading ? <p className="muted compact">正在读取种猫...</p> : null}
      {catError ? <p className="error-text">种猫读取失败：{catError}</p> : null}
      {groups.map((group, groupIndex) => {
        const pairings = records(group.pairings);
        const updatePairings = (next: JsonRecord[]) => updateGroup(groupIndex, { pairings: next });
        return <details className="environment-section-editor" key={string(group.id) || groupIndex}>
          <summary>{string(group.title) || `计划分组 ${groupIndex + 1}`} · {pairings.length} 组组合</summary>
          <div className="form-stack">
            <div className="form-actions">
              <button className="secondary-button small-button" type="button" disabled={groupIndex === 0} onClick={() => updateGroups(move(groups, groupIndex, groupIndex - 1))}>分组上移</button>
              <button className="secondary-button small-button" type="button" disabled={groupIndex === groups.length - 1} onClick={() => updateGroups(move(groups, groupIndex, groupIndex + 1))}>分组下移</button>
              <button className="danger-button small-button" type="button" onClick={() => {
                if (window.confirm("确定删除这个分组及其组合吗？")) updateGroups(groups.filter((_, index) => index !== groupIndex));
              }}>删除分组</button>
            </div>
            <div className="form-grid">
              <label>分组标题<input value={string(group.title)} onChange={(event) => updateGroup(groupIndex, { title: event.target.value })} /></label>
              <label>英文小标题<input value={string(group.eyebrow)} onChange={(event) => updateGroup(groupIndex, { eyebrow: event.target.value })} /></label>
            </div>
            <label>分组说明<textarea rows={3} value={string(group.description)} onChange={(event) => updateGroup(groupIndex, { description: event.target.value })} /></label>
            {pairings.map((pairing, pairingIndex) => {
              const colors = Array.isArray(pairing.possibleColors) ? pairing.possibleColors.map(string) : [];
              const updatePairing = (patch: JsonRecord) => updatePairings(pairings.map((item, index) => index === pairingIndex ? { ...item, ...patch } : item));
              return <div className="structured-section-card" key={string(pairing.id) || pairingIndex}>
                <div className="section-heading"><strong>繁育组合 #{pairingIndex + 1}</strong>
                  <div className="table-actions">
                    <button className="secondary-button small-button" type="button" disabled={pairingIndex === 0} onClick={() => updatePairings(move(pairings, pairingIndex, pairingIndex - 1))}>上移</button>
                    <button className="secondary-button small-button" type="button" disabled={pairingIndex === pairings.length - 1} onClick={() => updatePairings(move(pairings, pairingIndex, pairingIndex + 1))}>下移</button>
                    <button className="danger-button small-button" type="button" onClick={() => {
                      if (window.confirm("确定删除这组繁育组合吗？")) updatePairings(pairings.filter((_, index) => index !== pairingIndex));
                    }}>删除</button>
                  </div>
                </div>
                <div className="form-grid">
                  <CatSelect label="公猫" cats={maleCats} value={string(pairing.maleStudId)} onChange={(maleStudId) => updatePairing({ maleStudId })} />
                  <CatSelect label="母猫" cats={femaleCats} value={string(pairing.femaleStudId)} onChange={(femaleStudId) => updatePairing({ femaleStudId })} />
                </div>
                {(string(pairing.id) === "tianhe-zhaoyue-2026-h2" ||
                  (string(pairing.maleStudId) === "tianhe" && string(pairing.femaleStudId) === "zhaoyue"))
                  ? <p className="muted compact">这组组合按现有小程序展示规则隐藏。</p> : null}
                <label>预计时间<input value={string(pairing.timeLabel)} onChange={(event) => updatePairing({ timeLabel: event.target.value })} /></label>
                <div className="form-stack">
                  <strong>主要可能花色</strong>
                  {colors.map((color, colorIndex) => <div className="form-actions" key={`${pairingIndex}:${colorIndex}`}>
                    <input aria-label={`可能花色 ${colorIndex + 1}`} value={color} onChange={(event) => updatePairing({ possibleColors: colors.map((item, index) => index === colorIndex ? event.target.value : item) })} />
                    <button className="secondary-button small-button" type="button" disabled={colorIndex === 0} onClick={() => updatePairing({ possibleColors: move(colors, colorIndex, colorIndex - 1) })}>上移</button>
                    <button className="secondary-button small-button" type="button" disabled={colorIndex === colors.length - 1} onClick={() => updatePairing({ possibleColors: move(colors, colorIndex, colorIndex + 1) })}>下移</button>
                    <button className="danger-button small-button" type="button" onClick={() => updatePairing({ possibleColors: colors.filter((_, index) => index !== colorIndex) })}>移除</button>
                  </div>)}
                  <button className="secondary-button small-button" type="button" onClick={() => updatePairing({ possibleColors: [...colors, "新花色"] })}>新增花色</button>
                </div>
                <label>其他可能说明<textarea rows={3} value={string(pairing.colorPossibilityNote)} onChange={(event) => updatePairing({ colorPossibilityNote: event.target.value })} /></label>
              </div>;
            })}
            <button className="secondary-button" type="button" disabled={!maleCats.length || !femaleCats.length} onClick={() => updatePairings([...pairings, {
              id: `breeding-plan-pairing-${crypto.randomUUID()}`,
              maleStudId: maleCats[0] ? publicCatId(maleCats[0]) : "",
              femaleStudId: femaleCats[0] ? publicCatId(femaleCats[0]) : "",
              timeLabel: "", possibleColors: [], colorPossibilityNote: "",
            }])}>新增组合</button>
          </div>
        </details>;
      })}
      <button className="secondary-button" type="button" onClick={() => updateGroups([...groups, {
        id: `breeding-plan-group-${crypto.randomUUID()}`, eyebrow: "Upcoming", title: "新计划分组", description: "", pairings: [],
      }])}>新增分组</button>
    </section>
  </div>;
}

function CatSelect({ cats, label, onChange, value }: { cats: CatData[]; label: string; onChange: (value: string) => void; value: string }) {
  const selected = cats.some((cat) => publicCatId(cat) === value);
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">请选择{label}</option>
    {value && !selected ? <option value={value}>当前档案未找到：{value}</option> : null}
    {cats.map((cat) => <option key={cat.id} value={publicCatId(cat)}>{cat.name} · {cat.color || "颜色待补充"} · {publicCatId(cat)}</option>)}
  </select></label>;
}

function publicCatId(cat: CatData): string {
  const story = record(cat.storyJson);
  const source = record(story.source);
  return string(cat.publicContentId) || string(source.publicContentId) || cat.id.replace(/^public-content-cat-/, "");
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

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
