import type {
  CatData,
  CatListData,
  CommunityPostData,
  CommunityPostListData,
  CommunityPostCategory,
  FixedPageData,
  SelectionApplicationData,
  SubmitSelectionApplicationRequest,
} from "@starlitsky/shared";
import { get, post } from "../request";

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
