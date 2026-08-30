declare function App(options: Record<string, unknown>): void;

declare function Page(options: Record<string, unknown>): void;

declare const wx: {
  request(options: {
    url: string;
    method: "DELETE" | "GET" | "PATCH" | "POST";
    data?: unknown;
    header?: Record<string, string>;
    success(response: { statusCode: number; data: unknown }): void;
    fail(error: { errMsg?: string }): void;
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
