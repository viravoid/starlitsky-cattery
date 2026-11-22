export function getErrorMessage(error: unknown) {
  if (error instanceof TypeError && /failed to fetch|networkerror/i.test(error.message)) {
    return "网络连接中断，请检查连接后重试";
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
