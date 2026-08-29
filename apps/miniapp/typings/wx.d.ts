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
  getStorageSync(key: string): string;
  setStorageSync(key: string, value: string): void;
  removeStorageSync(key: string): void;
};
