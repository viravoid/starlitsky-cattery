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
  litterId: string;
  litterName: string;
  genderKey: string;
  statusKey: string;
}

export function toPublicCatCard(cat: CatData): PublicCatCard | null {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  const frame = resolveCatFrame(cat, "listCard");
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
      badge: status,
      lineOne: `${genderLabel(cat.gender)} · ${cat.color || "颜色待补充"}`,
      lineTwo: cat.birthday ? `生日 ${cat.birthday.slice(0, 10)}` : "生日待补充",
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
      badge: category,
      lineOne: cat.color || "颜色待补充",
      lineTwo: cat.breedingProfile.trait || cat.breedingProfile.source || "资料待补充",
      litterId: "",
      litterName: "",
      statusKey: category,
    };
  }

  return null;
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
