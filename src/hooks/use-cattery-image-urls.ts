import { getEntityImageBlob } from "@/lib/cattery-images";
import { useImageUrls } from "./use-image-urls";

export function useCatteryImageUrls(imageIds: (string | undefined)[]) {
  return useImageUrls(imageIds, getEntityImageBlob);
}
