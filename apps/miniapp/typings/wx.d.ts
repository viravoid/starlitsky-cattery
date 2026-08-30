declare function App(options: Record<string, unknown>): void;

declare function Page(options: Record<string, unknown>): void;

declare const wx: {
  request(options: {
    url: string;
    method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    data?: unknown;
    header?: Record<string, string>;
    success(response: { statusCode: number; data: unknown }): void;
    fail(error: { errMsg?: string }): void;
  }): void;
  chooseMedia(options: {
    count: number;
    mediaType: Array<"image" | "video">;
    sourceType?: Array<"album" | "camera">;
    success(response: {
      tempFiles: Array<{
        tempFilePath: string;
        size: number;
        fileType?: string;
      }>;
    }): void;
    fail?(error: { errMsg?: string }): void;
  }): void;
  getFileSystemManager(): {
    readFile(options: {
      filePath: string;
      success(response: { data: ArrayBuffer }): void;
      fail(error: { errMsg?: string }): void;
    }): void;
  };
  showModal(options: {
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    success(response: { confirm: boolean; cancel: boolean }): void;
    fail?(error: { errMsg?: string }): void;
  }): void;
  login(options: {
    success(response: { code: string; errMsg?: string }): void;
    fail(error: { errMsg?: string }): void;
  }): void;
  showToast(options: { title: string; icon?: "none" | "success" | "error" | "loading" }): void;
  navigateTo(options: { url: string }): void;
  previewImage(options: { current: string; urls: string[] }): void;
  setClipboardData(options: { data: string }): void;
  setNavigationBarTitle(options: { title: string }): void;
  stopPullDownRefresh(): void;
  switchTab(options: { url: string }): void;
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
};
