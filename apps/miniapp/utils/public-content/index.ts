import type {
  CatData,
  CatListData,
  CommunityCommentData,
  CommunityPostData,
  CommunityPostListData,
  CommunityPostCategory,
  CommunityPostOptionsData,
  CreateCommunityCommentRequest,
  CreateCommunityPostRequest,
  DeleteCommunityPostMediaData,
  FixedPageData,
  CompleteMediaUploadRequest,
  ImageUploadData,
  MediaAssetData,
  MyCatData,
  MyCatListData,
  SelectionApplicationData,
  SubmitSelectionApplicationRequest,
  ToggleCommunityPostLikeData,
  UpdateCommunityPostRequest,
} from "@starlitsky/shared";
import { get, post, patch, del } from "../request";

export async function getFixedPage(slug: string) {
  const response = await get<FixedPageData>(`/fixed-pages/${encodeURIComponent(slug)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listPublicCats(params: {
  lifecycleStatus?: string;
  pageSize?: number;
  q?: string;
}) {
  const response = await get<CatListData>(
    `/cats${toSearch({
      lifecycleStatus: params.lifecycleStatus,
      pageSize: String(params.pageSize ?? 100),
      q: params.q,
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getPublicCat(id: string) {
  const response = await get<CatData>(`/cats/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listMyCats(params: { pageSize?: number } = {}) {
  const response = await get<MyCatListData>(
    `/me/cats${toSearch({
      pageSize: String(params.pageSize ?? 100),
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getMyCat(id: string) {
  const response = await get<MyCatData>(`/me/cats/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listCommunityPosts(params: {
  category?: CommunityPostCategory | string;
  litterId?: string;
  pageSize?: number;
  q?: string;
} = {}) {
  const response = await get<CommunityPostListData>(
    `/community/posts${toSearch({
      category: params.category,
      litterId: params.litterId,
      pageSize: String(params.pageSize ?? 50),
      q: params.q,
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getCommunityPost(id: string) {
  const response = await get<CommunityPostData>(`/community/posts/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listMyCommunityPosts(params: { pageSize?: number } = {}) {
  const response = await get<CommunityPostListData>(
    `/community/posts/mine${toSearch({
      pageSize: String(params.pageSize ?? 50),
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getCommunityPostOptions() {
  const response = await get<CommunityPostOptionsData>("/community/post-options");
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function createCommunityPost(data: CreateCommunityPostRequest) {
  const response = await post<CommunityPostData, CreateCommunityPostRequest>(
    "/community/posts",
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function updateCommunityPost(id: string, data: UpdateCommunityPostRequest) {
  const response = await patch<CommunityPostData, UpdateCommunityPostRequest>(
    `/community/posts/${encodeURIComponent(id)}`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityPost(id: string) {
  const response = await del<CommunityPostData>(`/community/posts/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function toggleCommunityPostLike(id: string) {
  const response = await post<ToggleCommunityPostLikeData>(
    `/community/posts/${encodeURIComponent(id)}/like`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function createCommunityComment(id: string, content: string) {
  const response = await post<CommunityCommentData, CreateCommunityCommentRequest>(
    `/community/posts/${encodeURIComponent(id)}/comments`,
    { content },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityComment(postId: string, commentId: string) {
  const response = await del<CommunityCommentData>(
    `/community/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function requestCommunityPostImageUpload(
  postId: string,
  data: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    title?: string | null;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
    usage?: string;
    sortOrder?: number;
  },
) {
  const response = await post<ImageUploadData, typeof data>(
    `/community/posts/${encodeURIComponent(postId)}/media/uploads`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function completeCommunityPostImageUpload(
  postId: string,
  mediaId: string,
  data: CompleteMediaUploadRequest = {},
) {
  const response = await post<MediaAssetData, CompleteMediaUploadRequest>(
    `/community/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}/upload/complete`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityPostImage(postId: string, mediaId: string) {
  const response = await del<DeleteCommunityPostMediaData>(
    `/community/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function submitSelectionApplication(data: SubmitSelectionApplicationRequest) {
  const response = await post<SelectionApplicationData, SubmitSelectionApplicationRequest>(
    "/selection-applications",
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

function toSearch(params: Record<string, string | undefined>) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || "")}`);

  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}
