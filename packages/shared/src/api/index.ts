import type { PaginatedResponse } from "../common";

export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  message: string;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export interface HealthCheckData {
  status: "ok";
  service: string;
  environment: string;
  timestamp: string;
}

export interface CatData {
  id: string;
  name: string;
  gender: string | null;
  color: string | null;
  birthday: string | null;
  lifecycleStatus: string;
  personality: string | null;
  storyJson: unknown;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCatRequest {
  name: string;
  gender?: string | null;
  color?: string | null;
  birthday?: string | null;
  lifecycleStatus?: string;
  personality?: string | null;
  storyJson?: unknown;
  visibility?: string;
}

export type UpdateCatRequest = Partial<CreateCatRequest>;

export type CatListData = PaginatedResponse<CatData>;

export interface LitterRelatedCatData {
  id: string;
  name: string;
  gender: string | null;
  color: string | null;
  lifecycleStatus: string;
  visibility: string;
}

export interface LitterData {
  id: string;
  name: string;
  birthDate: string | null;
  expectedBirthDate: string | null;
  status: string;
  fatherCatId: string;
  motherCatId: string;
  fatherCat?: LitterRelatedCatData;
  motherCat?: LitterRelatedCatData;
  possibleColorsJson: unknown;
  colorNote: string | null;
  note: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateLitterRequest {
  name: string;
  birthDate?: string | null;
  expectedBirthDate?: string | null;
  status?: string;
  fatherCatId: string;
  motherCatId: string;
  possibleColorsJson?: unknown;
  colorNote?: string | null;
  note?: string | null;
  visibility?: string;
}

export type UpdateLitterRequest = Partial<CreateLitterRequest>;

export type LitterListData = PaginatedResponse<LitterData>;

export interface BreedingCatProfileData {
  catId: string;
  category: string;
  reproductiveState: string;
  statusLabel: string | null;
  trait: string | null;
  source: string | null;
  sortOrder: number;
}

export interface CreateBreedingCatProfileRequest {
  category: string;
  reproductiveState: string;
  statusLabel?: string | null;
  trait?: string | null;
  source?: string | null;
  sortOrder?: number;
}

export type UpdateBreedingCatProfileRequest = Partial<CreateBreedingCatProfileRequest>;

export interface KittenProfileData {
  catId: string;
  litterId: string;
  saleStatus: string;
  priceText: string | null;
  structureRatingJson: unknown;
  adoptedAt: string | null;
  cat?: LitterRelatedCatData;
  litter?: {
    id: string;
    name: string;
    status: string;
    fatherCatId: string;
    motherCatId: string;
    fatherCat?: LitterRelatedCatData;
    motherCat?: LitterRelatedCatData;
  };
}

export interface CreateKittenProfileRequest {
  litterId: string;
  saleStatus?: string;
  priceText?: string | null;
  structureRatingJson?: unknown;
  adoptedAt?: string | null;
}

export type UpdateKittenProfileRequest = Partial<CreateKittenProfileRequest>;

export interface AttachCatToLitterRequest {
  catId: string;
  saleStatus?: string;
  priceText?: string | null;
  structureRatingJson?: unknown;
  adoptedAt?: string | null;
}

export interface ParentProfileData {
  id: string;
  userId: string;
  displayName: string;
  realName: string | null;
  contactPhone: string | null;
  contactWechat: string | null;
  city: string | null;
  status: string;
  activatedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ParentProfileListData = PaginatedResponse<ParentProfileData>;

export interface CreateParentProfileRequest {
  displayName: string;
  realName?: string | null;
  contactPhone?: string | null;
  contactWechat?: string | null;
  city?: string | null;
  status?: string;
  note?: string | null;
}

export interface ParentCatLinkData {
  id: string;
  parentProfileId: string;
  catId: string;
  relationship: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  parentProfile?: ParentProfileData;
}

export interface CreateParentCatLinkRequest {
  parentProfileId: string;
  relationship: string;
  status?: string;
  startedAt?: string | null;
  endedAt?: string | null;
  note?: string | null;
}

export interface UpdateParentCatLinkRequest {
  status: string;
}

export interface MediaBindingData {
  id: string;
  mediaId: string;
  ownerType: string;
  ownerId: string;
  usage: string;
  sortOrder: number;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MediaAssetData {
  id: string;
  kind: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  altText: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  checksum: string | null;
  status: string;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  bindings: MediaBindingData[];
}

export interface CreateMediaAssetRequest {
  kind?: string;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  altText?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  checksum?: string | null;
  status?: string;
  metadataJson?: unknown;
  ownerType?: string;
  ownerId?: string;
  usage?: string;
  sortOrder?: number;
  bindingVisibility?: string;
}

export type UpdateMediaAssetRequest = Partial<
  Omit<
    CreateMediaAssetRequest,
    "bindingVisibility" | "ownerId" | "ownerType" | "sortOrder" | "usage"
  >
>;

export interface CreateMediaBindingRequest {
  ownerType: string;
  ownerId: string;
  usage?: string;
  sortOrder?: number;
  visibility?: string;
}

export type UpdateMediaBindingRequest = Partial<
  Pick<CreateMediaBindingRequest, "sortOrder" | "usage" | "visibility">
>;

export type MediaAssetListData = PaginatedResponse<MediaAssetData>;

export interface CreateImageUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  title?: string | null;
  altText?: string | null;
  checksum?: string | null;
  width?: number | null;
  height?: number | null;
  ownerType?: string;
  ownerId?: string;
  usage?: string;
  sortOrder?: number;
  bindingVisibility?: string;
}

export interface MediaUploadInstructionsData {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface ImageUploadData {
  media: MediaAssetData;
  upload: MediaUploadInstructionsData;
  objectKey: string;
  publicUrl: string;
}

export interface CompleteMediaUploadRequest {
  checksum?: string | null;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  thumbnailUrl?: string | null;
}

export type FixedPageSlug =
  | "home"
  | "about"
  | "philosophy"
  | "environment"
  | "feeding"
  | "process"
  | "aftercare"
  | "contact"
  | "questionnaire"
  | "breeding-plan";

export type FixedPageStatus = "draft" | "published" | "hidden";

export interface FixedPageData {
  id: string;
  slug: FixedPageSlug;
  title: string;
  status: FixedPageStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  contentSchemaVersion: number;
  contentJson: unknown;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type FixedPageListData = FixedPageData[];

export interface UpdateFixedPageRequest {
  title?: string;
  status?: FixedPageStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contentSchemaVersion?: number;
  contentJson?: unknown;
}
