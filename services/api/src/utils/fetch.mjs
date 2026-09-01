export async function fetchWithTimeout(resource, init = {}, timeoutMs = 5000) {
  const timeout = Number(timeoutMs);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    return fetch(resource, init);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(resource, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      const timeoutError = new Error("Upstream request timed out");
      timeoutError.code = "UPSTREAM_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isFetchTimeoutError(error) {
  return error?.code === "UPSTREAM_TIMEOUT" || error?.name === "AbortError";
}
