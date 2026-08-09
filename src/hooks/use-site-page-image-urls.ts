import { getSitePageImageBlob } from "@/lib/site-page-storage";
import { useImageUrls } from "./use-image-urls";

export function useSitePageImageUrls(imageIds: (string | undefined)[]) {
  return useImageUrls(imageIds, getSitePageImageBlob);
}
