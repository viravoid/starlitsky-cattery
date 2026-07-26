import { useEffect, useMemo, useState } from "react";
import { getEntityImageBlob } from "@/lib/cattery-images";

export function useCatteryImageUrls(imageIds: (string | undefined)[]) {
  const imageKey = imageIds.filter(Boolean).join("|");
  const stableImageIds = useMemo(
    () => Array.from(new Set(imageKey.split("|").filter(Boolean))),
    [imageKey],
  );
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function load() {
      const next: Record<string, string> = {};
      await Promise.all(
        stableImageIds.map(async (id) => {
          const blob = await getEntityImageBlob(id);
          if (!blob || !active) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          next[id] = url;
        }),
      );
      if (active) setUrls(next);
    }

    void load();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageKey, stableImageIds]);

  return urls;
}
