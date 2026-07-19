import { useEffect, useMemo, useState } from "react";
import { getSitePageImageBlob } from "@/lib/site-page-storage";

export function useSitePageImageUrls(imageIds: (string | undefined)[]) {
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
          const blob = await getSitePageImageBlob(id);
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
