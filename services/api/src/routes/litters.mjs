import {
  createLitter,
  deleteLitter,
  getLitter,
  listLitters,
  updateLitter,
} from "../services/litter-service.mjs";
import { attachExistingCatToLitter, listLitterKittens } from "../services/profile-service.mjs";
import { requireAdminMutationRole } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeLittersRequest(request, response, url, context) {
  const kittensLitterId = matchNestedLitterId(url.pathname, "kittens");
  if (kittensLitterId) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listLitterKittens(kittensLitterId),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await attachExistingCatToLitter(kittensLitterId, await readJsonBody(request)),
        message: "Cat attached to litter",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchLitterId(url.pathname);

  if (url.pathname === "/litters") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listLitters(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createLitter(await readJsonBody(request)),
        message: "Litter created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (id) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getLitter(id),
      });
      return;
    }

    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateLitter(id, await readJsonBody(request)),
        message: "Litter updated",
      });
      return;
    }

    if (request.method === "DELETE") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await deleteLitter(id),
        message: "Litter deleted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Litter route not found");
}

function matchLitterId(pathname) {
  const match = pathname.match(/^\/litters\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchNestedLitterId(pathname, nestedPath) {
  const match = pathname.match(new RegExp(`^/litters/([^/]+)/${nestedPath}$`));
  return match ? decodeURIComponent(match[1]) : null;
}
