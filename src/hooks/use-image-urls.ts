import { useEffect, useMemo, useState } from "react";
import { getStaticImageUrl } from "@/lib/real-photo-manifest.generated";

export function useImageUrls(
  imageIds: (string | undefined)[],
  loadBlob: (id: string) => Promise<Blob | null>,
) {
  const imageKey = imageIds.filter(Boolean).join("|");
  const stableImageIds = useMemo(
    () => Array.from(new Set(imageKey.split("|").filter(Boolean))),
    [imageKey],
  );
  const staticUrls = useMemo(() => {
    const next: Record<string, string> = {};
    for (const id of stableImageIds) {
      const url = getStaticImageUrl(id);
      if (url) next[id] = url;
    }
    return next;
  }, [stableImageIds]);
  const [urls, setUrls] = useState<Record<string, string>>(() => staticUrls);

  useEffect(() => {
    if (stableImageIds.length === 0) {
      setUrls({});
      return;
    }

    let active = true;
    const objectUrls: string[] = [];
    setUrls(staticUrls);

    async function load() {
      const next = { ...staticUrls };
      await Promise.all(
        stableImageIds.map(async (id) => {
          const blob = await loadBlob(id);
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
  }, [imageKey, loadBlob, stableImageIds, staticUrls]);

  return urls;
}
