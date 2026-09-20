import type { SelectedPostImage } from "./community-post-images";

type MaybePromise<T> = T | Promise<T>;

export interface PostImageUploadAdapter {
  uploadPostImage?(postId: string, image: SelectedPostImage, sortOrder: number): MaybePromise<void>;
}

let activeAdapter: PostImageUploadAdapter | null = null;

export function setPostImageUploadAdapter(adapter: PostImageUploadAdapter | null) {
  activeAdapter = adapter;
}

export function getPostImageUploadAdapter() {
  return activeAdapter;
}
