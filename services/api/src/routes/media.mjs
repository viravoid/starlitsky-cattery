import {
  createMedia,
  createMediaBinding,
  deleteMedia,
  deleteMediaBinding,
  getMedia,
  listMedia,
  listMediaBindings,
  updateMedia,
  updateMediaBinding,
} from "../services/media-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeMediaRequest(request, response, url) {
  const bindingRoute = matchMediaBindingRoute(url.pathname);
  if (bindingRoute) {
    if (bindingRoute.bindingId) {
      if (request.method === "PATCH") {
        sendSuccess(response, {
          data: await updateMediaBinding(
            bindingRoute.mediaId,
            bindingRoute.bindingId,
            await readJsonBody(request),
          ),
          message: "Media binding updated",
        });
        return;
      }

      if (request.method === "DELETE") {
        sendSuccess(response, {
          data: await deleteMediaBinding(bindingRoute.mediaId, bindingRoute.bindingId),
          message: "Media binding deleted",
        });
        return;
      }

      throw methodNotAllowed();
    }

    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listMediaBindings(bindingRoute.mediaId),
      });
      return;
    }

    if (request.method === "POST") {
      sendSuccess(response, {
        statusCode: 201,
        data: await createMediaBinding(bindingRoute.mediaId, await readJsonBody(request)),
        message: "Media binding created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchMediaId(url.pathname);

  if (url.pathname === "/media") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listMedia(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      sendSuccess(response, {
        statusCode: 201,
        data: await createMedia(await readJsonBody(request)),
        message: "Media asset created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (id) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getMedia(id),
      });
      return;
    }

    if (request.method === "PATCH") {
      sendSuccess(response, {
        data: await updateMedia(id, await readJsonBody(request)),
        message: "Media asset updated",
      });
      return;
    }

    if (request.method === "DELETE") {
      sendSuccess(response, {
        data: await deleteMedia(id),
        message: "Media asset deleted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Media route not found");
}

function matchMediaId(pathname) {
  const match = pathname.match(/^\/media\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchMediaBindingRoute(pathname) {
  const match = pathname.match(/^\/media\/([^/]+)\/bindings(?:\/([^/]+))?$/);
  if (!match) return null;
  return {
    mediaId: decodeURIComponent(match[1]),
    bindingId: match[2] ? decodeURIComponent(match[2]) : null,
  };
}
