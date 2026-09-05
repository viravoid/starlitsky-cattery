import type {
  CatData,
  CatListData,
  AttachCatToLitterRequest,
  AdminCommunityPostData,
  AdminCommunityPostListData,
  BreedingCatProfileData,
  CreatedAdminLoginChallengeData,
  CreateBreedingCatProfileRequest,
  CreateCatRequest,
  CreatedParentInviteData,
  CurrentUserResponseData,
  CreateKittenProfileRequest,
  CreateParentInviteRequest,
  CreateImageUploadRequest,
  CreateLitterRequest,
  CreateMediaAssetRequest,
  CreateMediaBindingRequest,
  CompleteMediaUploadRequest,
  FixedPageData,
  FixedPageListData,
  ImageUploadData,
  CreateParentCatLinkRequest,
  CreateParentProfileRequest,
  KittenProfileData,
  LitterData,
  LitterListData,
  MediaAssetData,
  MediaAssetListData,
  MediaBindingData,
  ModerateCommunityCommentRequest,
  ModerateCommunityPostRequest,
  ParentApplicationData,
  ParentApplicationListData,
  ParentCatLinkData,
  ParentProfileData,
  ParentProfileListData,
  ParentInviteData,
  ParentInviteListData,
  PollAdminLoginChallengeData,
  PollAdminLoginChallengeRequest,
  ReviewParentApplicationRequest,
  SelectionApplicationData,
  SelectionApplicationListData,
  UpdateBreedingCatProfileRequest,
  UpdateCatRequest,
  UpdateKittenProfileRequest,
  UpdateLitterRequest,
  UpdateFixedPageRequest,
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

export interface ListCommunityModerationParams {
  authorUserId?: string;
  category?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
  visibility?: string;
}

export function listCats(params: ListCatsParams = {}) {
  return unwrap<CatListData>(adminGet(`/cats${toSearch(params)}`));
}

export function getCurrentAdminUser() {
  return unwrap<CurrentUserResponseData>(adminGet("/auth/me"));
}

export function createAdminLoginChallenge() {
  return unwrap<CreatedAdminLoginChallengeData, Record<string, never>>(
    adminPost("/admin-auth/challenges", {}),
  );
}

export function pollAdminLoginChallenge(id: string, data: PollAdminLoginChallengeRequest) {
  return unwrap<PollAdminLoginChallengeData, PollAdminLoginChallengeRequest>(
    adminPost(`/admin-auth/challenges/${encodeURIComponent(id)}/poll`, data),
  );
}

export function logoutCurrentAdminSession() {
  return unwrap<null>(adminPost("/auth/logout"));
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

export function listParentInvites(params: ListParentInvitesParams = {}) {
  return unwrap<ParentInviteListData>(adminGet(`/parent-invites${toSearch(params)}`));
}

export function createParentInvite(data: CreateParentInviteRequest) {
  return unwrap<CreatedParentInviteData, CreateParentInviteRequest>(
    adminPost("/parent-invites", data),
  );
}

export function revokeParentInvite(id: string, data: ReviewParentApplicationRequest = {}) {
  return unwrap<ParentInviteData, ReviewParentApplicationRequest>(
    adminPost(`/parent-invites/${encodeURIComponent(id)}/revoke`, data),
  );
}

export function listParentApplications(params: ListParentApplicationsParams = {}) {
  return unwrap<ParentApplicationListData>(adminGet(`/parent-applications${toSearch(params)}`));
}

export function approveParentApplication(id: string, data: ReviewParentApplicationRequest = {}) {
  return unwrap<ParentApplicationData, ReviewParentApplicationRequest>(
    adminPost(`/parent-applications/${encodeURIComponent(id)}/approve`, data),
  );
}

export function rejectParentApplication(id: string, data: ReviewParentApplicationRequest = {}) {
  return unwrap<ParentApplicationData, ReviewParentApplicationRequest>(
    adminPost(`/parent-applications/${encodeURIComponent(id)}/reject`, data),
  );
}

export function listSelectionApplications(params: ListSelectionApplicationsParams = {}) {
  return unwrap<SelectionApplicationListData>(
    adminGet(`/selection-applications${toSearch(params)}`),
  );
}

export function getSelectionApplication(id: string) {
  return unwrap<SelectionApplicationData>(
    adminGet(`/selection-applications/${encodeURIComponent(id)}`),
  );
}

export function updateSelectionApplicationReview(
  id: string,
  data: UpdateSelectionApplicationReviewRequest,
) {
  return unwrap<SelectionApplicationData, UpdateSelectionApplicationReviewRequest>(
    adminPatch(`/selection-applications/${encodeURIComponent(id)}`, data),
  );
}

export function listMedia(params: ListMediaParams = {}) {
  return unwrap<MediaAssetListData>(adminGet(`/media${toSearch(params)}`));
}

export function listCommunityModerationPosts(params: ListCommunityModerationParams = {}) {
  return unwrap<AdminCommunityPostListData>(adminGet(`/community/admin/posts${toSearch(params)}`));
}

export function getCommunityModerationPost(id: string) {
  return unwrap<AdminCommunityPostData>(
    adminGet(`/community/admin/posts/${encodeURIComponent(id)}`),
  );
}

export function moderateCommunityPost(id: string, data: ModerateCommunityPostRequest) {
  return unwrap<AdminCommunityPostData, ModerateCommunityPostRequest>(
    adminPatch(`/community/admin/posts/${encodeURIComponent(id)}`, data),
  );
}

export function moderateCommunityComment(
  postId: string,
  commentId: string,
  data: ModerateCommunityCommentRequest,
) {
  return unwrap<AdminCommunityPostData["comments"][number], ModerateCommunityCommentRequest>(
    adminPatch(
      `/community/admin/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      data,
    ),
  );
}

export function listFixedPages() {
  return unwrap<FixedPageListData>(adminGet("/fixed-pages"));
}

export function getFixedPage(slug: string) {
  return unwrap<FixedPageData>(adminGet(`/fixed-pages/${encodeURIComponent(slug)}`));
}

export function updateFixedPage(slug: string, data: UpdateFixedPageRequest) {
  return unwrap<FixedPageData, UpdateFixedPageRequest>(
    adminPatch(`/fixed-pages/${encodeURIComponent(slug)}`, data),
  );
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

export function requestImageUpload(data: CreateImageUploadRequest) {
  return unwrap<ImageUploadData, CreateImageUploadRequest>(adminPost("/media/uploads", data));
}

export function completeMediaUpload(id: string, data: CompleteMediaUploadRequest = {}) {
  return unwrap<MediaAssetData, CompleteMediaUploadRequest>(
    adminPost(`/media/${encodeURIComponent(id)}/upload/complete`, data),
  );
}

async function uploadImageForOwner({
  altText,
  fallbackFileName,
  file,
  ownerId,
  ownerType,
  sortOrder,
  title,
  usage,
}: {
  altText?: string | null;
  fallbackFileName: string;
  file: File;
  ownerId: string;
  ownerType: string;
  sortOrder?: number;
  title?: string | null;
  usage: string;
}) {
  if (!file.type) {
    throw new Error("Image file MIME type is required");
  }

  const imageUpload = await requestImageUpload({
    altText: altText ?? file.name,
    fileName: file.name || fallbackFileName,
    mimeType: file.type,
    ownerId,
    ownerType,
    sizeBytes: file.size,
    sortOrder,
    title: title ?? file.name,
    usage,
    bindingVisibility: "visible",
  });

  const uploadResponse = await fetch(imageUpload.upload.url, {
    body: file,
    headers: imageUpload.upload.headers,
    method: imageUpload.upload.method,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Object storage upload failed with HTTP ${uploadResponse.status}`);
  }

  return completeMediaUpload(imageUpload.media.id, {
    sizeBytes: file.size,
  });
}

export function uploadCatImage(catId: string, file: File) {
  return uploadImageForOwner({
    fallbackFileName: "cat-image",
    file,
    ownerId: catId,
    ownerType: "cat",
    usage: "cover",
  });
}

export function uploadLitterImage(litterId: string, file: File) {
  return uploadImageForOwner({
    fallbackFileName: "litter-image",
    file,
    ownerId: litterId,
    ownerType: "litter",
    usage: "gallery",
  });
}

export function uploadFixedPageImage(
  pageId: string,
  file: File,
  options: {
    altText?: string | null;
    sortOrder?: number;
    title?: string | null;
    usage?: string;
  } = {},
) {
  return uploadImageForOwner({
    altText: options.altText,
    fallbackFileName: "fixed-page-image",
    file,
    ownerId: pageId,
    ownerType: "fixed_page",
    sortOrder: options.sortOrder,
    title: options.title,
    usage: options.usage ?? "gallery",
  });
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

export interface ListParentInvitesParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

export interface ListParentApplicationsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

export interface ListSelectionApplicationsParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}

export interface UpdateSelectionApplicationReviewRequest {
  status?: "submitted" | "reviewed";
  adminNote?: string | null;
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
