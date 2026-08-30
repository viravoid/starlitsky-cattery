import type {
  CatData,
  CatListData,
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
