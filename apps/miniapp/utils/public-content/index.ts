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
  CreateMyCatRequest,
  MyCatData,
  MyCatListData,
  SelectionApplicationData,
  SubmitSelectionApplicationRequest,
  ToggleCommunityPostLikeData,
  UpdateCommunityPostRequest,
  UpdateMyCatRequest,
} from "@starlitsky/shared";
import { get, post, patch, del } from "../request/index";
import { getPublicContentAdapter } from "./adapter";

export async function getFixedPage(slug: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.getFixedPage) return adapter.getFixedPage(slug);

  const response = await get<FixedPageData>(`/fixed-pages/${encodeURIComponent(slug)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listPublicCats(params: {
  lifecycleStatus?: string;
  pageSize?: number;
  q?: string;
}) {
  const adapter = getPublicContentAdapter();
  if (adapter?.listPublicCats) return adapter.listPublicCats(params);

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
  const adapter = getPublicContentAdapter();
  if (adapter?.getPublicCat) return adapter.getPublicCat(id);

  const response = await get<CatData>(`/cats/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listMyCats(params: { pageSize?: number } = {}) {
  const adapter = getPublicContentAdapter();
  if (adapter?.listMyCats) return adapter.listMyCats(params);

  const response = await get<MyCatListData>(
    `/me/cats${toSearch({
      pageSize: String(params.pageSize ?? 100),
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getMyCat(id: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.getMyCat) return adapter.getMyCat(id);

  const response = await get<MyCatData>(`/me/cats/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function createMyCat(data: CreateMyCatRequest) {
  const adapter = getPublicContentAdapter();
  if (adapter?.createMyCat) return adapter.createMyCat(data);

  const response = await post<MyCatData, CreateMyCatRequest>("/me/cats", data);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function updateMyCat(id: string, data: UpdateMyCatRequest) {
  const adapter = getPublicContentAdapter();
  if (adapter?.updateMyCat) return adapter.updateMyCat(id, data);

  const response = await patch<MyCatData, UpdateMyCatRequest>(
    `/me/cats/${encodeURIComponent(id)}`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteMyCat(id: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.deleteMyCat) return adapter.deleteMyCat(id);

  const response = await del<MyCatData>(`/me/cats/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listCommunityPosts(params: {
  catId?: string;
  category?: CommunityPostCategory | string;
  litterId?: string;
  pageSize?: number;
  q?: string;
} = {}) {
  const adapter = getPublicContentAdapter();
  if (adapter?.listCommunityPosts) return adapter.listCommunityPosts(params);

  const response = await get<CommunityPostListData>(
    `/community/posts${toSearch({
      catId: params.catId,
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
  const adapter = getPublicContentAdapter();
  if (adapter?.getCommunityPost) return adapter.getCommunityPost(id);

  const response = await get<CommunityPostData>(`/community/posts/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function listMyCommunityPosts(params: { pageSize?: number } = {}) {
  const adapter = getPublicContentAdapter();
  if (adapter?.listMyCommunityPosts) return adapter.listMyCommunityPosts(params);

  const response = await get<CommunityPostListData>(
    `/community/posts/mine${toSearch({
      pageSize: String(params.pageSize ?? 50),
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getCommunityPostOptions() {
  const adapter = getPublicContentAdapter();
  if (adapter?.getCommunityPostOptions) return adapter.getCommunityPostOptions();

  const response = await get<CommunityPostOptionsData>("/community/post-options");
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function createCommunityPost(data: CreateCommunityPostRequest) {
  const adapter = getPublicContentAdapter();
  if (adapter?.createCommunityPost) return adapter.createCommunityPost(data);

  const response = await post<CommunityPostData, CreateCommunityPostRequest>(
    "/community/posts",
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function updateCommunityPost(id: string, data: UpdateCommunityPostRequest) {
  const adapter = getPublicContentAdapter();
  if (adapter?.updateCommunityPost) return adapter.updateCommunityPost(id, data);

  const response = await patch<CommunityPostData, UpdateCommunityPostRequest>(
    `/community/posts/${encodeURIComponent(id)}`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityPost(id: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.deleteCommunityPost) return adapter.deleteCommunityPost(id);

  const response = await del<CommunityPostData>(`/community/posts/${encodeURIComponent(id)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function toggleCommunityPostLike(id: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.toggleCommunityPostLike) return adapter.toggleCommunityPostLike(id);

  const response = await post<ToggleCommunityPostLikeData>(
    `/community/posts/${encodeURIComponent(id)}/like`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function createCommunityComment(id: string, content: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.createCommunityComment) return adapter.createCommunityComment(id, content);

  const response = await post<CommunityCommentData, CreateCommunityCommentRequest>(
    `/community/posts/${encodeURIComponent(id)}/comments`,
    { content },
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityComment(postId: string, commentId: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.deleteCommunityComment) return adapter.deleteCommunityComment(postId, commentId);

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
  const adapter = getPublicContentAdapter();
  if (adapter?.requestCommunityPostImageUpload) {
    return adapter.requestCommunityPostImageUpload(postId, data);
  }

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
  const adapter = getPublicContentAdapter();
  if (adapter?.completeCommunityPostImageUpload) {
    return adapter.completeCommunityPostImageUpload(postId, mediaId, data);
  }

  const response = await post<MediaAssetData, CompleteMediaUploadRequest>(
    `/community/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}/upload/complete`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function deleteCommunityPostImage(postId: string, mediaId: string) {
  const adapter = getPublicContentAdapter();
  if (adapter?.deleteCommunityPostImage) return adapter.deleteCommunityPostImage(postId, mediaId);

  const response = await del<DeleteCommunityPostMediaData>(
    `/community/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function submitSelectionApplication(data: SubmitSelectionApplicationRequest) {
  const adapter = getPublicContentAdapter();
  if (adapter?.submitSelectionApplication) return adapter.submitSelectionApplication(data);

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
