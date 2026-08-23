import type {
  CatData,
  CatListData,
  AttachCatToLitterRequest,
  BreedingCatProfileData,
  CreateBreedingCatProfileRequest,
  CreateCatRequest,
  CreateKittenProfileRequest,
  CreateLitterRequest,
  CreateMediaAssetRequest,
  CreateMediaBindingRequest,
  CreateParentCatLinkRequest,
  CreateParentProfileRequest,
  KittenProfileData,
  LitterData,
  LitterListData,
  MediaAssetData,
  MediaAssetListData,
  MediaBindingData,
  ParentCatLinkData,
  ParentProfileData,
  ParentProfileListData,
  UpdateBreedingCatProfileRequest,
  UpdateCatRequest,
  UpdateKittenProfileRequest,
  UpdateLitterRequest,
  UpdateMediaAssetRequest,
  UpdateMediaBindingRequest,
  UpdateParentCatLinkRequest,
} from "@starlitsky/shared";
import { adminDelete, adminGet, adminPatch, adminPost } from "./request";

export interface ListCatsParams {
  includeDeleted?: boolean;
  lifecycleStatus?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  visibility?: string;
}

export interface ListLittersParams {
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  visibility?: string;
}

export interface ListMediaParams {
  includeDeleted?: boolean;
  kind?: string;
  ownerId?: string;
  ownerType?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

export function listCats(params: ListCatsParams = {}) {
  return unwrap<CatListData>(adminGet(`/cats${toSearch(params)}`));
}

export function getCat(id: string) {
  return unwrap<CatData>(adminGet(`/cats/${encodeURIComponent(id)}`));
}

export function createCat(data: CreateCatRequest) {
  return unwrap<CatData, CreateCatRequest>(adminPost("/cats", data));
}

export function updateCat(id: string, data: UpdateCatRequest) {
  return unwrap<CatData, UpdateCatRequest>(adminPatch(`/cats/${encodeURIComponent(id)}`, data));
}

export function archiveCat(id: string) {
  return unwrap<CatData>(adminDelete(`/cats/${encodeURIComponent(id)}`));
}

export function getBreedingProfile(catId: string) {
  return unwrap<BreedingCatProfileData>(
    adminGet(`/cats/${encodeURIComponent(catId)}/breeding-profile`),
  );
}

export function createBreedingProfile(catId: string, data: CreateBreedingCatProfileRequest) {
  return unwrap<BreedingCatProfileData, CreateBreedingCatProfileRequest>(
    adminPost(`/cats/${encodeURIComponent(catId)}/breeding-profile`, data),
  );
}

export function updateBreedingProfile(catId: string, data: UpdateBreedingCatProfileRequest) {
  return unwrap<BreedingCatProfileData, UpdateBreedingCatProfileRequest>(
    adminPatch(`/cats/${encodeURIComponent(catId)}/breeding-profile`, data),
  );
}

export function getKittenProfile(catId: string) {
  return unwrap<KittenProfileData>(adminGet(`/cats/${encodeURIComponent(catId)}/kitten-profile`));
}

export function createKittenProfile(catId: string, data: CreateKittenProfileRequest) {
  return unwrap<KittenProfileData, CreateKittenProfileRequest>(
    adminPost(`/cats/${encodeURIComponent(catId)}/kitten-profile`, data),
  );
}

export function updateKittenProfile(catId: string, data: UpdateKittenProfileRequest) {
  return unwrap<KittenProfileData, UpdateKittenProfileRequest>(
    adminPatch(`/cats/${encodeURIComponent(catId)}/kitten-profile`, data),
  );
}

export function listCatParentLinks(catId: string) {
  return unwrap<ParentCatLinkData[]>(adminGet(`/cats/${encodeURIComponent(catId)}/parent-links`));
}

export function createCatParentLink(catId: string, data: CreateParentCatLinkRequest) {
  return unwrap<ParentCatLinkData, CreateParentCatLinkRequest>(
    adminPost(`/cats/${encodeURIComponent(catId)}/parent-links`, data),
  );
}

export function listLitters(params: ListLittersParams = {}) {
  return unwrap<LitterListData>(adminGet(`/litters${toSearch(params)}`));
}

export function getLitter(id: string) {
  return unwrap<LitterData>(adminGet(`/litters/${encodeURIComponent(id)}`));
}

export function createLitter(data: CreateLitterRequest) {
  return unwrap<LitterData, CreateLitterRequest>(adminPost("/litters", data));
}

export function updateLitter(id: string, data: UpdateLitterRequest) {
  return unwrap<LitterData, UpdateLitterRequest>(
    adminPatch(`/litters/${encodeURIComponent(id)}`, data),
  );
}

export function listLitterKittens(litterId: string) {
  return unwrap<KittenProfileData[]>(adminGet(`/litters/${encodeURIComponent(litterId)}/kittens`));
}

export function attachCatToLitter(litterId: string, data: AttachCatToLitterRequest) {
  return unwrap<KittenProfileData, AttachCatToLitterRequest>(
    adminPost(`/litters/${encodeURIComponent(litterId)}/kittens`, data),
  );
}

export function listParentProfiles(params: ListParentProfilesParams = {}) {
  return unwrap<ParentProfileListData>(adminGet(`/parent-profiles${toSearch(params)}`));
}

export function createParentProfile(data: CreateParentProfileRequest) {
  return unwrap<ParentProfileData, CreateParentProfileRequest>(adminPost("/parent-profiles", data));
}

export function updateParentCatLink(id: string, data: UpdateParentCatLinkRequest) {
  return unwrap<ParentCatLinkData, UpdateParentCatLinkRequest>(
    adminPatch(`/parent-cat-links/${encodeURIComponent(id)}`, data),
  );
}

export function listMedia(params: ListMediaParams = {}) {
  return unwrap<MediaAssetListData>(adminGet(`/media${toSearch(params)}`));
}

export function getMedia(id: string) {
  return unwrap<MediaAssetData>(adminGet(`/media/${encodeURIComponent(id)}`));
}

export function createMedia(data: CreateMediaAssetRequest) {
  return unwrap<MediaAssetData, CreateMediaAssetRequest>(adminPost("/media", data));
}

export function updateMedia(id: string, data: UpdateMediaAssetRequest) {
  return unwrap<MediaAssetData, UpdateMediaAssetRequest>(
    adminPatch(`/media/${encodeURIComponent(id)}`, data),
  );
}

export function archiveMedia(id: string) {
  return unwrap<MediaAssetData>(adminDelete(`/media/${encodeURIComponent(id)}`));
}

export function createMediaBinding(mediaId: string, data: CreateMediaBindingRequest) {
  return unwrap<MediaBindingData, CreateMediaBindingRequest>(
    adminPost(`/media/${encodeURIComponent(mediaId)}/bindings`, data),
  );
}

export function updateMediaBinding(
  mediaId: string,
  bindingId: string,
  data: UpdateMediaBindingRequest,
) {
  return unwrap<MediaBindingData, UpdateMediaBindingRequest>(
    adminPatch(
      `/media/${encodeURIComponent(mediaId)}/bindings/${encodeURIComponent(bindingId)}`,
      data,
    ),
  );
}

export function archiveMediaBinding(mediaId: string, bindingId: string) {
  return unwrap<MediaBindingData>(
    adminDelete(`/media/${encodeURIComponent(mediaId)}/bindings/${encodeURIComponent(bindingId)}`),
  );
}

export interface ListParentProfilesParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

async function unwrap<TData, TBody = unknown>(
  request: ReturnType<typeof adminGet<TData>> | ReturnType<typeof adminPost<TData, TBody>>,
) {
  const response = await request;
  if (response.success) return response.data;
  throw new Error(response.message);
}

function toSearch(params: object) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "boolean" && typeof value !== "number" && typeof value !== "string") {
      continue;
    }
    if (value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
