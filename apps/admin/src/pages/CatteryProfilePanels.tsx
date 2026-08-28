import type {
  BreedingCatProfileData,
  CatData,
  CreateBreedingCatProfileRequest,
  CreateKittenProfileRequest,
  CreateParentCatLinkRequest,
  CreateParentProfileRequest,
  KittenProfileData,
  LitterData,
  ParentCatLinkData,
  ParentProfileData,
  UpdateBreedingCatProfileRequest,
  UpdateKittenProfileRequest,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  attachCatToLitter,
  createBreedingProfile,
  createCatParentLink,
  createKittenProfile,
  createParentProfile,
  getBreedingProfile,
  getKittenProfile,
  listCatParentLinks,
  listLitterKittens,
  listParentProfiles,
  updateBreedingProfile,
  updateKittenProfile,
  updateParentCatLink,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface BreedingFormState {
  category: string;
  reproductiveState: string;
  sortOrder: string;
  source: string;
  statusLabel: string;
  trait: string;
}

interface KittenFormState {
  adoptedAt: string;
  litterId: string;
  priceText: string;
  saleStatus: string;
  structureRatingJson: string;
}

interface ParentProfileFormState {
  city: string;
  contactPhone: string;
  contactWechat: string;
  displayName: string;
  note: string;
  realName: string;
}

interface ParentLinkFormState {
  note: string;
  parentProfileId: string;
  relationship: string;
  status: string;
}

interface AttachKittenFormState {
  catId: string;
  priceText: string;
  saleStatus: string;
}

const DEFAULT_BREEDING_FORM: BreedingFormState = {
  category: "king",
  reproductiveState: "active",
  sortOrder: "0",
  source: "",
  statusLabel: "",
  trait: "",
};

const DEFAULT_KITTEN_FORM: KittenFormState = {
  adoptedAt: "",
  litterId: "",
  priceText: "",
  saleStatus: "evaluating",
  structureRatingJson: "",
};

const DEFAULT_PARENT_PROFILE_FORM: ParentProfileFormState = {
  city: "",
  contactPhone: "",
  contactWechat: "",
  displayName: "",
  note: "",
  realName: "",
};

const DEFAULT_PARENT_LINK_FORM: ParentLinkFormState = {
  note: "",
  parentProfileId: "",
  relationship: "owner",
  status: "active",
};

const BREEDING_CATEGORY_OPTIONS = [
  { label: "公猫", value: "king" },
  { label: "母猫", value: "queen" },
  { label: "保留观察", value: "candidate" },
];

const REPRODUCTIVE_STATE_OPTIONS = [
  { label: "繁育中", value: "active" },
  { label: "观察中", value: "observing" },
  { label: "暂停", value: "paused" },
  { label: "退休", value: "retired" },
];

const SALE_STATUS_OPTIONS = [
  { label: "评估中", value: "evaluating" },
  { label: "可咨询", value: "available" },
  { label: "已预定", value: "reserved" },
  { label: "已去新家", value: "adopted" },
  { label: "留繁", value: "retained" },
];

const RELATIONSHIP_OPTIONS = [
  { label: "主人", value: "owner" },
  { label: "共同主人", value: "co_owner" },
  { label: "照护人", value: "caregiver" },
];

const LINK_STATUS_OPTIONS = [
  { label: "生效", value: "active" },
  { label: "暂停", value: "paused" },
  { label: "结束", value: "ended" },
];

export function CatArchivePanel({ cat, litters }: { cat: CatData; litters: LitterData[] }) {
  const [breedingProfile, setBreedingProfile] = useState<BreedingCatProfileData | null>(null);
  const [kittenProfile, setKittenProfile] = useState<KittenProfileData | null>(null);
  const [parentLinks, setParentLinks] = useState<ParentCatLinkData[]>([]);
  const [parentProfiles, setParentProfiles] = useState<ParentProfileData[]>([]);
  const [breedingForm, setBreedingForm] = useState<BreedingFormState>(DEFAULT_BREEDING_FORM);
  const [kittenForm, setKittenForm] = useState<KittenFormState>(DEFAULT_KITTEN_FORM);
  const [parentProfileForm, setParentProfileForm] = useState<ParentProfileFormState>(
    DEFAULT_PARENT_PROFILE_FORM,
  );
  const [parentLinkForm, setParentLinkForm] =
    useState<ParentLinkFormState>(DEFAULT_PARENT_LINK_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadArchive = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [breeding, kitten, links, profiles] = await Promise.all([
        optional(() => getBreedingProfile(cat.id)),
        optional(() => getKittenProfile(cat.id)),
        listCatParentLinks(cat.id),
        listParentProfiles({ pageSize: 100 }),
      ]);

      setBreedingProfile(breeding);
      setKittenProfile(kitten);
      setParentLinks(links);
      setParentProfiles(profiles.items);
      setBreedingForm(breeding ? toBreedingForm(breeding) : DEFAULT_BREEDING_FORM);
      setKittenForm(
        kitten
          ? toKittenForm(kitten)
          : {
              ...DEFAULT_KITTEN_FORM,
              litterId: litters[0]?.id ?? "",
            },
      );
      setParentLinkForm((current) => ({
        ...current,
        parentProfileId: profiles.items[0]?.id ?? "",
      }));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [cat.id, litters]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  async function handleBreedingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toBreedingPayload(breedingForm);
      const saved = breedingProfile
        ? await updateBreedingProfile(cat.id, payload)
        : await createBreedingProfile(cat.id, payload as CreateBreedingCatProfileRequest);

      setBreedingProfile(saved);
      setBreedingForm(toBreedingForm(saved));
      setNotice(breedingProfile ? "种猫档案已更新" : "种猫档案已创建");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleKittenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toKittenPayload(kittenForm);
      const saved = kittenProfile
        ? await updateKittenProfile(cat.id, payload)
        : await createKittenProfile(cat.id, payload as CreateKittenProfileRequest);

      setKittenProfile(saved);
      setKittenForm(toKittenForm(saved));
      setNotice(kittenProfile ? "小猫档案已更新" : "小猫档案已创建");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParentProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const profile = await createParentProfile(toParentProfilePayload(parentProfileForm));
      setParentProfiles((current) => [profile, ...current]);
      setParentLinkForm((current) => ({
        ...current,
        parentProfileId: profile.id,
      }));
      setParentProfileForm(DEFAULT_PARENT_PROFILE_FORM);
      setNotice("家长档案已创建");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParentLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const link = await createCatParentLink(cat.id, toParentLinkPayload(parentLinkForm));
      setParentLinks((current) => [link, ...current]);
      setNotice("家长关联已新增");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParentLinkStatusChange(linkId: string, status: string) {
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await updateParentCatLink(linkId, { status });
      setParentLinks((current) => current.map((link) => (link.id === updated.id ? updated : link)));
      setNotice("家长关联状态已更新");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="archive-stack">
      <div className="subsection-heading">
        <h4>完整猫咪业务档案</h4>
        <button className="secondary-button small-button" type="button" onClick={loadArchive}>
          刷新档案
        </button>
      </div>
      {isLoading ? <div className="empty-state">正在加载业务档案...</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <form className="inline-form" onSubmit={handleBreedingSubmit}>
        <h4>种猫档案</h4>
        <div className="form-grid">
          <FieldSelect
            label="分类"
            options={BREEDING_CATEGORY_OPTIONS}
            value={breedingForm.category}
            onChange={(category) => setBreedingForm({ ...breedingForm, category })}
          />
          <FieldSelect
            label="繁育状态"
            options={REPRODUCTIVE_STATE_OPTIONS}
            value={breedingForm.reproductiveState}
            onChange={(reproductiveState) =>
              setBreedingForm({ ...breedingForm, reproductiveState })
            }
          />
        </div>
        <div className="form-grid">
          <FieldInput
            label="状态标签"
            value={breedingForm.statusLabel}
            onChange={(statusLabel) => setBreedingForm({ ...breedingForm, statusLabel })}
          />
          <FieldInput
            label="排序"
            value={breedingForm.sortOrder}
            onChange={(sortOrder) => setBreedingForm({ ...breedingForm, sortOrder })}
          />
        </div>
        <FieldInput
          label="特征"
          value={breedingForm.trait}
          onChange={(trait) => setBreedingForm({ ...breedingForm, trait })}
        />
        <FieldInput
          label="来源"
          value={breedingForm.source}
          onChange={(source) => setBreedingForm({ ...breedingForm, source })}
        />
        <button disabled={isSaving} type="submit">
          {breedingProfile ? "保存种猫档案" : "创建种猫档案"}
        </button>
      </form>

      <form className="inline-form" onSubmit={handleKittenSubmit}>
        <h4>小猫档案</h4>
        <FieldSelect
          label="所属窝次"
          options={litters.map((litter) => ({ label: litter.name, value: litter.id }))}
          value={kittenForm.litterId}
          onChange={(litterId) => setKittenForm({ ...kittenForm, litterId })}
        />
        <div className="form-grid">
          <FieldSelect
            label="销售状态"
            options={SALE_STATUS_OPTIONS}
            value={kittenForm.saleStatus}
            onChange={(saleStatus) => setKittenForm({ ...kittenForm, saleStatus })}
          />
          <FieldInput
            label="价格文本"
            value={kittenForm.priceText}
            onChange={(priceText) => setKittenForm({ ...kittenForm, priceText })}
          />
        </div>
        <FieldInput
          label="领养时间"
          placeholder="YYYY-MM-DD"
          value={kittenForm.adoptedAt}
          onChange={(adoptedAt) => setKittenForm({ ...kittenForm, adoptedAt })}
        />
        <label>
          结构评分 JSON
          <textarea
            aria-label="结构评分 JSON"
            rows={3}
            value={kittenForm.structureRatingJson}
            onChange={(event) =>
              setKittenForm({
                ...kittenForm,
                structureRatingJson: event.target.value,
              })
            }
          />
        </label>
        <button disabled={isSaving || litters.length === 0} type="submit">
          {kittenProfile ? "保存小猫档案" : "创建小猫档案"}
        </button>
      </form>

      <form className="inline-form" onSubmit={handleParentProfileSubmit}>
        <h4>新增家长档案</h4>
        <FieldInput
          label="展示名"
          required
          value={parentProfileForm.displayName}
          onChange={(displayName) => setParentProfileForm({ ...parentProfileForm, displayName })}
        />
        <div className="form-grid">
          <FieldInput
            label="真实姓名"
            value={parentProfileForm.realName}
            onChange={(realName) => setParentProfileForm({ ...parentProfileForm, realName })}
          />
          <FieldInput
            label="城市"
            value={parentProfileForm.city}
            onChange={(city) => setParentProfileForm({ ...parentProfileForm, city })}
          />
        </div>
        <div className="form-grid">
          <FieldInput
            label="电话"
            value={parentProfileForm.contactPhone}
            onChange={(contactPhone) =>
              setParentProfileForm({ ...parentProfileForm, contactPhone })
            }
          />
          <FieldInput
            label="微信"
            value={parentProfileForm.contactWechat}
            onChange={(contactWechat) =>
              setParentProfileForm({ ...parentProfileForm, contactWechat })
            }
          />
        </div>
        <button disabled={isSaving} type="submit">
          创建家长档案
        </button>
      </form>

      <form className="inline-form" onSubmit={handleParentLinkSubmit}>
        <h4>家长关联</h4>
        <FieldSelect
          label="家长"
          options={parentProfiles.map((profile) => ({
            label: profile.displayName,
            value: profile.id,
          }))}
          value={parentLinkForm.parentProfileId}
          onChange={(parentProfileId) => setParentLinkForm({ ...parentLinkForm, parentProfileId })}
        />
        <div className="form-grid">
          <FieldSelect
            label="关系"
            options={RELATIONSHIP_OPTIONS}
            value={parentLinkForm.relationship}
            onChange={(relationship) => setParentLinkForm({ ...parentLinkForm, relationship })}
          />
          <FieldSelect
            label="状态"
            options={LINK_STATUS_OPTIONS}
            value={parentLinkForm.status}
            onChange={(status) => setParentLinkForm({ ...parentLinkForm, status })}
          />
        </div>
        <FieldInput
          label="备注"
          value={parentLinkForm.note}
          onChange={(note) => setParentLinkForm({ ...parentLinkForm, note })}
        />
        <button disabled={isSaving || parentProfiles.length === 0} type="submit">
          新增关联
        </button>
        <div className="mini-list">
          {parentLinks.length === 0 ? (
            <p className="muted compact">暂无家长关联</p>
          ) : (
            parentLinks.map((link) => (
              <div className="mini-list-row" key={link.id}>
                <span>{link.parentProfile?.displayName ?? link.parentProfileId}</span>
                <span>{formatOption(link.relationship, RELATIONSHIP_OPTIONS)}</span>
                <select
                  aria-label={`关联状态 ${link.parentProfile?.displayName ?? link.id}`}
                  value={link.status}
                  onChange={(event) =>
                    void handleParentLinkStatusChange(link.id, event.target.value)
                  }
                >
                  {LINK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </form>
    </div>
  );
}

export function LitterKittensPanel({ cats, litter }: { cats: CatData[]; litter: LitterData }) {
  const [kittens, setKittens] = useState<KittenProfileData[]>([]);
  const [form, setForm] = useState<AttachKittenFormState>({
    catId: "",
    priceText: "",
    saleStatus: "evaluating",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const availableCats = useMemo(() => {
    const kittenCatIds = new Set(kittens.map((kitten) => kitten.catId));
    return cats.filter((cat) => !kittenCatIds.has(cat.id));
  }, [cats, kittens]);

  const loadKittens = useCallback(async () => {
    setError("");
    try {
      const items = await listLitterKittens(litter.id);
      const kittenCatIds = new Set(items.map((kitten) => kitten.catId));
      const firstAvailableCatId = cats.find((cat) => !kittenCatIds.has(cat.id))?.id ?? "";
      setKittens(items);
      setForm((current) => ({
        ...current,
        catId: current.catId || firstAvailableCatId,
      }));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }, [cats, litter.id]);

  useEffect(() => {
    void loadKittens();
  }, [loadKittens]);

  async function handleAttachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const kitten = await attachCatToLitter(litter.id, {
        catId: form.catId,
        priceText: emptyToNull(form.priceText),
        saleStatus: form.saleStatus,
      });
      setKittens((current) => [kitten, ...current]);
      setNotice("已有猫已关联到该窝次");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="archive-stack">
      <div className="subsection-heading">
        <h4>该窝次的小猫</h4>
        <button className="secondary-button small-button" type="button" onClick={loadKittens}>
          刷新小猫
        </button>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="mini-list">
        {kittens.length === 0 ? (
          <p className="muted compact">暂无小猫档案</p>
        ) : (
          kittens.map((kitten) => (
            <div className="mini-list-row" key={kitten.catId}>
              <span>{kitten.cat?.name ?? kitten.catId}</span>
              <span>{formatOption(kitten.saleStatus, SALE_STATUS_OPTIONS)}</span>
              <span>{kitten.priceText || "-"}</span>
            </div>
          ))
        )}
      </div>
      <form className="inline-form" onSubmit={handleAttachSubmit}>
        <h4>关联已有猫</h4>
        <FieldSelect
          label="猫"
          options={availableCats.map((cat) => ({ label: cat.name, value: cat.id }))}
          value={form.catId}
          onChange={(catId) => setForm({ ...form, catId })}
        />
        <div className="form-grid">
          <FieldSelect
            label="销售状态"
            options={SALE_STATUS_OPTIONS}
            value={form.saleStatus}
            onChange={(saleStatus) => setForm({ ...form, saleStatus })}
          />
          <FieldInput
            label="价格文本"
            value={form.priceText}
            onChange={(priceText) => setForm({ ...form, priceText })}
          />
        </div>
        <button disabled={isSaving || availableCats.length === 0} type="submit">
          关联到窝次
        </button>
      </form>
    </div>
  );
}

function FieldInput({
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FieldSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

async function optional<TData>(loader: () => Promise<TData>) {
  try {
    return await loader();
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.includes("not found")) return null;
    throw error;
  }
}

function toBreedingForm(profile: BreedingCatProfileData): BreedingFormState {
  return {
    category: profile.category,
    reproductiveState: profile.reproductiveState,
    sortOrder: String(profile.sortOrder),
    source: profile.source ?? "",
    statusLabel: profile.statusLabel ?? "",
    trait: profile.trait ?? "",
  };
}

function toBreedingPayload(
  form: BreedingFormState,
): CreateBreedingCatProfileRequest | UpdateBreedingCatProfileRequest {
  return {
    category: form.category,
    reproductiveState: form.reproductiveState,
    sortOrder: Number(form.sortOrder || 0),
    source: emptyToNull(form.source),
    statusLabel: emptyToNull(form.statusLabel),
    trait: emptyToNull(form.trait),
  };
}

function toKittenForm(profile: KittenProfileData): KittenFormState {
  return {
    adoptedAt: toDateInputValue(profile.adoptedAt),
    litterId: profile.litterId,
    priceText: profile.priceText ?? "",
    saleStatus: profile.saleStatus,
    structureRatingJson:
      profile.structureRatingJson == null
        ? ""
        : JSON.stringify(profile.structureRatingJson, null, 2),
  };
}

function toKittenPayload(
  form: KittenFormState,
): CreateKittenProfileRequest | UpdateKittenProfileRequest {
  return {
    adoptedAt: form.adoptedAt || null,
    litterId: form.litterId,
    priceText: emptyToNull(form.priceText),
    saleStatus: form.saleStatus,
    structureRatingJson: parseOptionalJson(form.structureRatingJson),
  };
}

function toParentProfilePayload(form: ParentProfileFormState): CreateParentProfileRequest {
  return {
    city: emptyToNull(form.city),
    contactPhone: emptyToNull(form.contactPhone),
    contactWechat: emptyToNull(form.contactWechat),
    displayName: form.displayName.trim(),
    note: emptyToNull(form.note),
    realName: emptyToNull(form.realName),
  };
}

function toParentLinkPayload(form: ParentLinkFormState): CreateParentCatLinkRequest {
  return {
    note: emptyToNull(form.note),
    parentProfileId: form.parentProfileId,
    relationship: form.relationship,
    status: form.status,
  };
}

function parseOptionalJson(value: string) {
  if (!value.trim()) return null;
  return JSON.parse(value);
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}
