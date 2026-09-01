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

export type UserRole = "user" | "parent" | "keeper" | "admin";

export interface CurrentUserData {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  status: string;
  roles: UserRole[];
  currentRole: UserRole;
  parentProfile: {
    id: string;
    displayName: string;
    status: string;
    activatedAt: string | null;
  } | null;
}

export interface WechatLoginRequest {
  code: string;
}

export interface AuthSessionData {
  token: string;
  expiresAt: string;
  user: CurrentUserData;
  verificationMode: "wechat" | "mock";
}

export interface CurrentUserResponseData {
  user: CurrentUserData;
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
  breedingProfile: BreedingCatProfileData | null;
  kittenProfile:
    | (KittenProfileData & {
        litter?: KittenProfileData["litter"] | null;
      })
    | null;
  mediaAssets: CatMediaAssetData[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CatMediaAssetData {
  id: string;
  kind: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  altText: string | null;
  usage: string;
  sortOrder: number;
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

export type ParentInviteStatus = "active" | "used" | "revoked";
export type ParentApplicationStatus = "pending" | "approved" | "rejected";

export interface UserSummaryData {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  phone: string | null;
}

export interface ParentInviteData {
  id: string;
  shortCode: string;
  status: ParentInviteStatus | string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  note: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserSummaryData | null;
  revokedBy: UserSummaryData | null;
  isUsable: boolean;
  invalidReason: string | null;
}

export interface CreatedParentInviteData extends ParentInviteData {
  token: string;
  qr: ParentInviteQrData;
}

export interface ParentInviteQrData {
  provider: "wechat" | "dev-mock" | "unavailable";
  status: "ready" | "mock" | "unavailable";
  page: string;
  scene: string;
  imageDataUrl: string | null;
  message: string;
}

export interface ParentInvitePublicData {
  id: string;
  shortCode: string;
  status: ParentInviteStatus | string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isUsable: boolean;
  invalidReason: string | null;
}

export interface VerifyParentInviteData {
  valid: boolean;
  reason: string | null;
  invite: ParentInvitePublicData | null;
}

export interface CreateParentInviteRequest {
  expiresAt?: string | null;
  maxUses?: number;
  note?: string | null;
}

export interface ReviewParentApplicationRequest {
  adminNote?: string | null;
}

export interface ExistingCatClaimData {
  catId: string;
  relationship: string;
  startedAt: string | null;
  note: string | null;
  cat?: {
    id: string;
    name: string;
    gender: string | null;
    color: string | null;
    lifecycleStatus: string;
    visibility: string;
    deletedAt: string | null;
  } | null;
}

export interface NewCatApplicationData {
  name: string;
  gender: string | null;
  color: string | null;
  birthday: string | null;
  arrivedAt: string | null;
  personality: string | null;
  note: string | null;
  relationship: string;
}

export interface SubmitParentApplicationRequest {
  inviteCode?: string;
  inviteToken?: string;
  qrCredential?: string;
  displayName: string;
  realName?: string | null;
  contactPhone?: string | null;
  contactWechat?: string | null;
  city?: string | null;
  existingCatClaims?: Array<{
    catId: string;
    relationship?: string;
    startedAt?: string | null;
    note?: string | null;
  }>;
  newCats?: Array<{
    name: string;
    gender?: string | null;
    color?: string | null;
    birthday?: string | null;
    arrivedAt?: string | null;
    personality?: string | null;
    note?: string | null;
    relationship?: string;
  }>;
}

export interface ParentApplicationData {
  id: string;
  userId: string;
  status: ParentApplicationStatus | string;
  displayName: string;
  realName: string | null;
  contactPhone: string | null;
  contactWechat: string | null;
  city: string | null;
  existingCatClaims: ExistingCatClaimData[];
  newCats: NewCatApplicationData[];
  adminNote: string | null;
  reviewedAt: string | null;
  approvedParentProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserSummaryData | null;
  invite: ParentInvitePublicData | null;
  reviewedBy: UserSummaryData | null;
}

export type ParentInviteListData = PaginatedResponse<ParentInviteData>;
export type ParentApplicationListData = PaginatedResponse<ParentApplicationData>;

export interface ParentClaimCatCandidateData {
  id: string;
  name: string;
  gender: string | null;
  color: string | null;
  birthday: string | null;
  lifecycleStatus: string;
}

export type ParentClaimCatCandidateListData = PaginatedResponse<ParentClaimCatCandidateData>;

export type SelectionApplicationStatus = "submitted" | "reviewed";

export interface SelectionApplicationAnswers {
  name: string;
  gender: string;
  phone: string;
  age: string;
  job: string;
  city: string;
  experience: string;
  residents: string;
  residentsNeutered?: string;
  hasKids: string;
  housing: string;
  windowSealed: string;
  familyAgree: string;
  maineCoonKnowledge?: string;
  wantGender: string;
  wantColor: string;
  budget: string;
  acceptNeuter: string;
  monthlySpend: string;
  scientificFeeding: string;
  acceptActive: string;
  commitment: string;
  additionalNote?: string;
}

export interface SubmitSelectionApplicationRequest extends SelectionApplicationAnswers {
  clientDedupKey?: string;
}

export interface SelectionApplicationData {
  id: string;
  userId: string | null;
  contactName: string;
  contactGender: string;
  contactPhone: string;
  contactAge: string;
  contactJob: string;
  contactCity: string;
  catExperience: {
    experience: string;
  };
  existingPets: {
    residents: string;
    residentsNeutered: string | null;
  };
  livingEnvironment: {
    hasKids: string;
    housing: string;
    windowSealed: string;
    familyAgree: string;
  };
  maineCoonKnowledge: string | null;
  preferences: {
    wantGender: string;
    wantColor: string;
    budget: string;
    monthlySpend: string;
  };
  commitments: {
    acceptNeuter: string;
    scientificFeeding: string;
    acceptActive: string;
    commitment: string;
  };
  additionalNote: string | null;
  status: SelectionApplicationStatus | string;
  submittedAt: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserSummaryData | null;
  reviewedBy: UserSummaryData | null;
}

export type SelectionApplicationListData = PaginatedResponse<SelectionApplicationData>;

export interface UpdateSelectionApplicationReviewRequest {
  status?: SelectionApplicationStatus;
  adminNote?: string | null;
}

export type CommunityPostCategory = "cattery_daily" | "parent_share" | "personal_thoughts";

export interface CommunityPostMediaAssetData {
  id: string;
  kind: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  altText: string | null;
  usage: string;
  sortOrder: number;
}

export interface CommunityPostRelatedCatData {
  id: string;
  name: string;
  gender: string | null;
  color: string | null;
  lifecycleStatus: string;
  visibility?: string;
}

export interface CommunityPostRelatedLitterData {
  id: string;
  name: string;
  status: string;
  birthDate: string | null;
  expectedBirthDate: string | null;
  visibility?: string;
}

export interface CommunityCommentData {
  id: string;
  postId: string;
  authorName: string;
  authorRole: string;
  content: string;
  visibility: string;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AdminCommunityPostData extends CommunityPostData {
  authorUserId: string;
  deletedAt: string | null;
}

export interface CommunityPostData {
  id: string;
  authorName: string;
  authorRole: string;
  category: CommunityPostCategory | string;
  content: string;
  visibility: string;
  pinned: boolean;
  cats: CommunityPostRelatedCatData[];
  litters: CommunityPostRelatedLitterData[];
  mediaAssets: CommunityPostMediaAssetData[];
  comments: CommunityCommentData[];
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CommunityPostListData = PaginatedResponse<CommunityPostData>;
export type AdminCommunityPostListData = PaginatedResponse<AdminCommunityPostData>;

export interface MyCatData {
  id: string;
  name: string;
  gender: string | null;
  color: string | null;
  birthday: string | null;
  lifecycleStatus: string;
  personality: string | null;
  visibility: string;
  mediaAssets: CatMediaAssetData[];
  relationship: string;
  relationshipStartedAt: string | null;
  litter: CommunityPostRelatedLitterData | null;
  timelinePosts: CommunityPostData[];
  createdAt: string;
  updatedAt: string;
}

export type MyCatListData = PaginatedResponse<MyCatData>;

export interface CommunityPostOptionsData {
  categories: CommunityPostCategory[];
  cats: Array<
    CommunityPostRelatedCatData & {
      relationship?: string;
      startedAt?: string | null;
    }
  >;
  litters: CommunityPostRelatedLitterData[];
}

export interface CreateCommunityPostRequest {
  category: CommunityPostCategory;
  content: string;
  catIds?: string[];
  litterIds?: string[];
  visibility?: string;
  pinned?: boolean;
}

export type UpdateCommunityPostRequest = Partial<CreateCommunityPostRequest>;

export interface ModerateCommunityPostRequest {
  visibility?: string;
  pinned?: boolean;
  deleted?: boolean;
}

export interface ToggleCommunityPostLikeData {
  liked: boolean;
  likeCount: number;
}

export interface CreateCommunityCommentRequest {
  content: string;
}

export interface ModerateCommunityCommentRequest {
  visibility?: string;
  deleted?: boolean;
}

export interface DeleteCommunityPostMediaData {
  id: string;
  bindingId: string;
  ownerType: string;
  ownerId: string;
  deletedAt: string | null;
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
  mediaAssets: FixedPageMediaAssetData[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type FixedPageListData = FixedPageData[];

export interface FixedPageMediaAssetData {
  id: string;
  kind: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  altText: string | null;
  usage: string;
  sortOrder: number;
}

export interface UpdateFixedPageRequest {
  title?: string;
  status?: FixedPageStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contentSchemaVersion?: number;
  contentJson?: unknown;
}
