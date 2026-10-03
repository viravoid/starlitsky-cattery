import { getMiniProgramEnvVersion } from "../../config/env";

export const VISUAL_QA_QUERY_KEY = "visualQa";

let visualQaRequested = false;

export function configureVisualQaMode(query: Record<string, string | undefined> = {}) {
  visualQaRequested = query[VISUAL_QA_QUERY_KEY] === "1";
}

export function isVisualQaModeEnabled() {
  return visualQaRequested && getMiniProgramEnvVersion() === "develop";
}
