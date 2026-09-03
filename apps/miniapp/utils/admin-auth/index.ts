import type {
  ApproveAdminLoginChallengeRequest,
  ResolvedAdminLoginChallengeData,
  ResolveAdminLoginChallengeRequest,
} from "@starlitsky/shared";
import { post } from "../request";

export async function resolveAdminLoginChallenge(data: ResolveAdminLoginChallengeRequest) {
  const response = await post<ResolvedAdminLoginChallengeData, ResolveAdminLoginChallengeRequest>(
    "/admin-auth/challenges/resolve",
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}

export async function approveAdminLoginChallenge(
  id: string,
  data: ApproveAdminLoginChallengeRequest,
) {
  const response = await post<ResolvedAdminLoginChallengeData, ApproveAdminLoginChallengeRequest>(
    `/admin-auth/challenges/${encodeURIComponent(id)}/approve`,
    data,
  );
  if (!response.success) throw new Error(response.message);
  return response.data;
}
