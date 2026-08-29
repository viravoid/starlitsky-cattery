import { createCat, deleteCat, getCat, listCats, updateCat } from "../services/cat-service.mjs";
import {
  createBreedingProfile,
  createCatParentLink,
  createKittenProfile,
  getBreedingProfile,
  getKittenProfile,
  listCatParentLinks,
  updateBreedingProfile,
  updateKittenProfile,
} from "../services/profile-service.mjs";
import { requireAdminMutationRole } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeCatsRequest(request, response, url, context) {
  const breedingProfileCatId = matchNestedCatId(url.pathname, "breeding-profile");
  if (breedingProfileCatId) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getBreedingProfile(breedingProfileCatId),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createBreedingProfile(breedingProfileCatId, await readJsonBody(request)),
        message: "Breeding profile created",
      });
      return;
    }

    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateBreedingProfile(breedingProfileCatId, await readJsonBody(request)),
        message: "Breeding profile updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const kittenProfileCatId = matchNestedCatId(url.pathname, "kitten-profile");
  if (kittenProfileCatId) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getKittenProfile(kittenProfileCatId),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createKittenProfile(kittenProfileCatId, await readJsonBody(request)),
        message: "Kitten profile created",
      });
      return;
    }

    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateKittenProfile(kittenProfileCatId, await readJsonBody(request)),
        message: "Kitten profile updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const parentLinksCatId = matchNestedCatId(url.pathname, "parent-links");
  if (parentLinksCatId) {
    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await listCatParentLinks(parentLinksCatId),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createCatParentLink(parentLinksCatId, await readJsonBody(request)),
        message: "Parent cat link created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchCatId(url.pathname);

  if (url.pathname === "/cats") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listCats(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createCat(await readJsonBody(request)),
        message: "Cat created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (id) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getCat(id),
      });
      return;
    }

    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateCat(id, await readJsonBody(request)),
        message: "Cat updated",
      });
      return;
    }

    if (request.method === "DELETE") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await deleteCat(id),
        message: "Cat deleted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Cat route not found");
}

function matchCatId(pathname) {
  const match = pathname.match(/^\/cats\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchNestedCatId(pathname, nestedPath) {
  const match = pathname.match(new RegExp(`^/cats/([^/]+)/${nestedPath}$`));
  return match ? decodeURIComponent(match[1]) : null;
}
