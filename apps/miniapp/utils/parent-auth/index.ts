import type {
  ParentClaimCatCandidateListData,
  ParentApplicationData,
  SubmitParentApplicationRequest,
  ParentPhoneVerificationData,
} from "@starlitsky/shared";
import { get, post } from "../request/index";

export async function verifyParentPhone(code: string) {
  const response = await post<ParentPhoneVerificationData, { code: string }>(
    "/parent-applications/phone-verifications",
    { code },
  );
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

export async function searchCats(query: string) {
  const response = await get<ParentClaimCatCandidateListData>(
    `/parent-applications/cat-candidates${toSearch({
      pageSize: "20",
      q: query.trim(),
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
