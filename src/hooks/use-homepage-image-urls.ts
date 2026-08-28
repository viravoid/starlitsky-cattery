import { getHomepageImageBlob } from "@/lib/homepage-storage";
import { useImageUrls } from "./use-image-urls";

export function useHomepageImageUrls(imageIds: (string | undefined)[]) {
  return useImageUrls(imageIds, getHomepageImageBlob);
}
