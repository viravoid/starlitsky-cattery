import {
  completeCommunityPostImageUpload,
  createCommunityComment,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPostMedia,
  deleteCommunityPost,
  getAdminCommunityPost,
  getCommunityPost,
  getCommunityPostOptions,
  listAdminCommunityPosts,
  listCommunityPosts,
  listMyCommunityPosts,
  moderateCommunityComment,
  moderateCommunityPost,
  requestCommunityPostImageUpload,
  toggleCommunityPostLike,
  updateCommunityPost,
} from "../services/community-service.mjs";
import { getCurrentUserFromRequest } from "../services/auth-service.mjs";
import { requireAdminMutationRole, requireAuth } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeCommunityRequest(request, response, url, context) {
  if (url.pathname === "/community/admin/posts") {
    const user = await requireAdminMutationRole(request, context.config);
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listAdminCommunityPosts(url.searchParams, user),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const adminPostModerationRoute = matchAdminPostModerationRoute(url.pathname);
  if (adminPostModerationRoute) {
    const user = await requireAdminMutationRole(request, context.config);
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getAdminCommunityPost(adminPostModerationRoute.postId, user),
      });
      return;
    }

    if (request.method === "PATCH") {
      sendSuccess(response, {
        data: await moderateCommunityPost(
          adminPostModerationRoute.postId,
          await readJsonBody(request),
          user,
        ),
        message: "Community post moderated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const adminCommentModerationRoute = matchAdminCommentModerationRoute(url.pathname);
  if (adminCommentModerationRoute) {
    const user = await requireAdminMutationRole(request, context.config);
    if (request.method === "PATCH") {
      sendSuccess(response, {
        data: await moderateCommunityComment(
          adminCommentModerationRoute.postId,
          adminCommentModerationRoute.commentId,
          await readJsonBody(request),
          user,
        ),
        message: "Community comment moderated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (url.pathname === "/community/post-options") {
    if (request.method === "GET") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await getCommunityPostOptions(user),
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (url.pathname === "/community/posts/mine") {
    if (request.method === "GET") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await listMyCommunityPosts(url.searchParams, user),
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (url.pathname === "/community/posts") {
    if (request.method === "GET") {
      const viewer = await getCurrentUserFromRequest(request, context.config);
      sendSuccess(response, {
        data: await listCommunityPosts(url.searchParams, viewer),
      });
      return;
    }

    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createCommunityPost(await readJsonBody(request), user),
        message: "Community post created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const likePostId = matchNestedPostRoute(url.pathname, "like");
  if (likePostId) {
    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await toggleCommunityPostLike(likePostId, user),
        message: "Community post like toggled",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const commentsPostId = matchNestedPostRoute(url.pathname, "comments");
  if (commentsPostId) {
    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createCommunityComment(commentsPostId, await readJsonBody(request), user),
        message: "Community comment created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const commentRoute = matchCommentRoute(url.pathname);
  if (commentRoute) {
    if (request.method === "DELETE") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await deleteCommunityComment(commentRoute.postId, commentRoute.commentId, user),
        message: "Community comment deleted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const uploadPostId = matchNestedPostRoute(url.pathname, "media/uploads");
  if (uploadPostId) {
    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await requestCommunityPostImageUpload(uploadPostId, await readJsonBody(request), user),
        message: "Community post media upload created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const uploadCompleteRoute = matchPostMediaUploadCompleteRoute(url.pathname);
  if (uploadCompleteRoute) {
    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await completeCommunityPostImageUpload(
          uploadCompleteRoute.postId,
          uploadCompleteRoute.mediaId,
          await readJsonBody(request),
          user,
        ),
        message: "Community post media upload completed",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const postMediaRoute = matchPostMediaRoute(url.pathname);
  if (postMediaRoute) {
    if (request.method === "DELETE") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await deleteCommunityPostMedia(postMediaRoute.postId, postMediaRoute.mediaId, user),
        message: "Community post media deleted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchPostId(url.pathname);
  if (id) {
    if (request.method === "GET") {
      const viewer = await getCurrentUserFromRequest(request, context.config);
      sendSuccess(response, {
        data: await getCommunityPost(id, viewer),
      });
      return;
    }

    if (request.method === "PATCH") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await updateCommunityPost(id, await readJsonBody(request), user),
        message: "Community post updated",
      });
      return;
    }

    if (request.method === "DELETE") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await deleteCommunityPost(id, user),
        message: "Community post deleted",
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

function matchAdminPostModerationRoute(pathname) {
  const match = pathname.match(/^\/community\/admin\/posts\/([^/]+)$/);
  if (!match) return null;
  return {
    postId: decodeURIComponent(match[1]),
  };
}

function matchAdminCommentModerationRoute(pathname) {
  const match = pathname.match(/^\/community\/admin\/posts\/([^/]+)\/comments\/([^/]+)$/);
  if (!match) return null;
  return {
    postId: decodeURIComponent(match[1]),
    commentId: decodeURIComponent(match[2]),
  };
}

function matchNestedPostRoute(pathname, nestedPath) {
  const match = pathname.match(new RegExp(`^/community/posts/([^/]+)/${nestedPath}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function matchCommentRoute(pathname) {
  const match = pathname.match(/^\/community\/posts\/([^/]+)\/comments\/([^/]+)$/);
  if (!match) return null;
  return {
    postId: decodeURIComponent(match[1]),
    commentId: decodeURIComponent(match[2]),
  };
}

function matchPostMediaUploadCompleteRoute(pathname) {
  const match = pathname.match(/^\/community\/posts\/([^/]+)\/media\/([^/]+)\/upload\/complete$/);
  if (!match) return null;
  return {
    postId: decodeURIComponent(match[1]),
    mediaId: decodeURIComponent(match[2]),
  };
}

function matchPostMediaRoute(pathname) {
  const match = pathname.match(/^\/community\/posts\/([^/]+)\/media\/([^/]+)$/);
  if (!match) return null;
  return {
    postId: decodeURIComponent(match[1]),
    mediaId: decodeURIComponent(match[2]),
  };
}
