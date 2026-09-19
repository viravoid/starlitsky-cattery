import type { CommunityPostMediaAssetData } from "@starlitsky/shared";
import {
  completeCommunityPostImageUpload,
  requestCommunityPostImageUpload,
} from "./public-content/index";
import { isVisualQaModeEnabled } from "./visual-qa/mode";

export interface SelectedPostImage {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  tempFilePath: string;
}

export interface ExistingPostImage {
  id: string;
  removed: boolean;
  url: string;
}

export function toExistingPostImage(media: CommunityPostMediaAssetData): ExistingPostImage | null {
  const url = media.sourceUrl || media.thumbnailUrl || "";
  return url ? { id: media.id, removed: false, url } : null;
}

export function inferPostImageMimeType(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

export async function uploadPostImage(
  postId: string,
  image: SelectedPostImage,
  sortOrder: number,
) {
  const upload = await requestCommunityPostImageUpload(postId, {
    fileName: image.fileName,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    usage: "gallery",
    sortOrder,
  });
  if (isVisualQaModeEnabled()) {
    await completeCommunityPostImageUpload(postId, upload.media.id, { sizeBytes: image.sizeBytes });
    return;
  }
  const data = await readFile(image.tempFilePath);
  await putUpload(upload.upload.url, upload.upload.headers, data);
  await completeCommunityPostImageUpload(postId, upload.media.id, { sizeBytes: image.sizeBytes });
}

function readFile(filePath: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(response) {
        resolve(response.data);
      },
      fail(error) {
        reject(new Error(error.errMsg || "读取图片失败"));
      },
    });
  });
}

function putUpload(url: string, headers: Record<string, string>, data: ArrayBuffer) {
  return new Promise<void>((resolve, reject) => {
    wx.request({
      url,
      method: "PUT",
      data,
      header: headers,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
          return;
        }
        reject(new Error("图片上传失败"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "图片上传失败"));
      },
    });
  });
}
