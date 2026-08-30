import { getCommunityPost, listCommunityPosts } from "../services/community-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeCommunityRequest(request, response, url) {
  if (url.pathname === "/community/posts") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listCommunityPosts(url.searchParams),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchPostId(url.pathname);
  if (id) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getCommunityPost(id),
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Community route not found");
}

function matchPostId(pathname) {
  const match = pathname.match(/^\/community\/posts\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
