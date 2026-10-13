import { badRequest } from "../utils/errors.mjs";

export const PARENT_CAT_LINK_RELATIONSHIPS = new Set(["owner", "co_owner", "caregiver"]);
export const PARENT_CAT_LINK_STATUSES = new Set(["active", "ended", "inactive"]);

export function validateParentCatLinkRelationship(value, fieldName = "relationship") {
  if (!PARENT_CAT_LINK_RELATIONSHIPS.has(value)) {
    throw badRequest(`${fieldName} must be one of: owner, co_owner, caregiver`);
  }
  return value;
}

export function validateParentCatLinkStatus(value, fieldName = "status") {
  if (!PARENT_CAT_LINK_STATUSES.has(value)) {
    throw badRequest(`${fieldName} must be one of: active, ended, inactive`);
  }
  return value;
}
