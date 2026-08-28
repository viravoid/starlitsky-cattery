import {
  createParentProfile,
  listParentProfiles,
  updateParentCatLink,
} from "../services/profile-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeParentsRequest(request, response, url) {
  if (url.pathname === "/parent-profiles") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listParentProfiles(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      sendSuccess(response, {
        statusCode: 201,
        data: await createParentProfile(await readJsonBody(request)),
        message: "Parent profile created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const parentCatLinkId = matchParentCatLinkId(url.pathname);
  if (parentCatLinkId) {
    if (request.method === "PATCH") {
      sendSuccess(response, {
        data: await updateParentCatLink(parentCatLinkId, await readJsonBody(request)),
        message: "Parent cat link updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Parent route not found");
}

function matchParentCatLinkId(pathname) {
  const match = pathname.match(/^\/parent-cat-links\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
