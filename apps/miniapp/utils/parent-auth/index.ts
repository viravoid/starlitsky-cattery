import type {
  ParentClaimCatCandidateListData,
  ParentApplicationData,
  SubmitParentApplicationRequest,
  VerifyParentInviteData,
} from "@starlitsky/shared";
import { get, post } from "../request";

export async function verifyParentInvite(params: {
  code?: string;
  token?: string;
  qrCredential?: string;
}) {
  const response = await get<VerifyParentInviteData>(`/parent-invites/verify${toSearch(params)}`);
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function submitParentApplication(data: SubmitParentApplicationRequest) {
  const response = await post<ParentApplicationData, SubmitParentApplicationRequest>(
    "/parent-applications",
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function getMyParentApplication() {
  const response = await get<ParentApplicationData | null>("/parent-applications/mine");
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function searchCats(
  query: string,
  credential: { code?: string; token?: string; qrCredential?: string },
) {
  const response = await get<ParentClaimCatCandidateListData>(
    `/parent-applications/cat-candidates${toSearch({
      pageSize: "20",
      q: query.trim(),
      ...credential,
    })}`,
  );
  if (!response.success) throw new Error(response.message);
  return response.data.items;
}

function toSearch(params: Record<string, string | undefined>) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || "")}`);

  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}
