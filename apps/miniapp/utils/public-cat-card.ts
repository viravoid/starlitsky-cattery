import type { CatData } from "@starlitsky/shared";
import { resolveCatFrame, type ImageFrameMode } from "./cat-presentation";

export interface PublicCatCard {
  id: string;
  kind: "kittens" | "studs";
  name: string;
  imageClass: string;
  imageMode: ImageFrameMode;
  imageStyle: string;
  imageUrl: string;
  badge: string;
  lineOne: string;
  lineTwo: string;
  cardGender: string;
  cardGrade: string;
  cardAge: string;
  cardIdentity: string;
  cardColor: string;
  cardNote: string;
  litterId: string;
  litterName: string;
  genderKey: string;
  statusKey: string;
}

export function toPublicCatCard(cat: CatData): PublicCatCard | null {
  return buildPublicCatCard(cat, false);
}

export function toPortraitPublicCatCard(cat: CatData): PublicCatCard | null {
  return buildPublicCatCard(cat, true);
}

function buildPublicCatCard(cat: CatData, portrait: boolean): PublicCatCard | null {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  const frame = resolveCatFrame(cat, "listCard", portrait ? 4 / 5 : undefined);
  const common = {
    id: cat.id,
    name: cat.name,
    imageClass: frame?.style ? "thumb-image positioned-image" : "thumb-image",
    imageMode: frame?.mode ?? "aspectFill",
    imageStyle: frame?.style ?? "",
    imageUrl: frame?.url || image?.thumbnailUrl || image?.sourceUrl || "",
    genderKey: cat.gender || "",
  };

  if (cat.kittenProfile) {
    const status = saleStatusLabel(cat.kittenProfile.saleStatus);
    return {
      ...common,
      kind: "kittens",
      cardGrade: cat.grade === "pet" ? "宠物级" : cat.grade === "show" ? "赛级" : "",
      badge: status,
      lineOne: `${genderLabel(cat.gender)} · ${cat.color || "颜色待补充"}`,
      lineTwo: cat.birthday ? `生日 ${cat.birthday.slice(0, 10)}` : "生日待补充",
      cardGender: cat.gender === "male" || cat.gender === "female" ? genderLabel(cat.gender) : "",
      cardAge: ageLabel(cat.birthday) || "年龄待补充",
      cardIdentity: "",
      cardColor: "",
      cardNote: "",
      litterId: cat.kittenProfile.litter?.id || "",
      litterName: formatLitterName(cat.kittenProfile.litter?.name || ""),
      statusKey: status,
    };
  }

  if (cat.breedingProfile) {
    const category = breedingCategoryLabel(cat.breedingProfile.category);
    return {
      ...common,
      kind: "studs",
      cardGrade: "",
      badge: category,
      lineOne: cat.color || "颜色待补充",
      lineTwo: cat.breedingProfile.trait || cat.breedingProfile.source || "资料待补充",
      cardGender: cat.gender === "male" || cat.gender === "female" ? genderLabel(cat.gender) : "",
      cardAge: ageLabel(cat.birthday) || "年龄待补充",
      cardIdentity: category,
      cardColor: displayableCardText(cat.color),
      cardNote:
        nonColorCardNote(cat.breedingProfile.trait) || nonColorCardNote(cat.personality),
      litterId: "",
      litterName: "",
      statusKey: category,
    };
  }

  return null;
}

function ageLabel(birthday: string | null) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}/.test(birthday)) return "";
  const born = new Date(`${birthday.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(born.getTime())) return "";
  const today = new Date();
  let months = (today.getFullYear() - born.getFullYear()) * 12 + today.getMonth() - born.getMonth();
  if (today.getDate() < born.getDate()) months -= 1;
  if (months < 0) return "";
  if (months === 0) return "未满1个月";
  if (months < 12) return `${months}个月`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years}岁${remainingMonths}个月` : `${years}岁`;
}

function displayableCardText(value: string | null) {
  const text = value?.trim() || "";
  return /^示例文字[（(]缺少/.test(text) || ["待补充", "颜色待补充", "资料待补充"].includes(text)
    ? ""
    : text;
}

function nonColorCardNote(value: string | null) {
  return displayableCardText(value)
    .split(/[，,、；;。]/)
    .map((part) => part.trim())
    .filter((part) => part && !/花纹|花色|毛色|颜色|色块|加白|银度|虎斑|玳瑁|麻纹|鱼骨纹|烟色/.test(part))
    .join("，");
}

export function isSeekingHomeKitten(cat: CatData) {
  return (
    cat.visibility === "visible" &&
    cat.kittenProfile != null &&
    ["available", "reserved", "evaluating"].includes(cat.kittenProfile.saleStatus)
  );
}

function formatLitterName(value: string) {
  const match = value.match(/([A-Z])\s*窝/i);
  return match ? `${match[1].toUpperCase()}窝` : value;
}

function genderLabel(value: string | null) {
  if (value === "male") return "弟弟";
  if (value === "female") return "妹妹";
  return "未设置";
}

function saleStatusLabel(value: string) {
  if (value === "available") return "待找家";
  if (value === "reserved") return "找家中";
  if (value === "adopted") return "已有家";
  if (value === "evaluating") return "观察中";
  return value || "待评估";
}

function breedingCategoryLabel(value: string) {
  if (value === "king") return "现役公猫";
  if (value === "queen") return "现役母猫";
  if (value === "candidate") return "预备役种猫";
  return value || "种猫";
}
