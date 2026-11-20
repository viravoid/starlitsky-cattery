export const logger = {
  info(message) {
    console.log(format("info", message));
  },
  warn(message) {
    console.warn(format("warn", message));
  },
  error(message, error) {
    console.error(format("error", message));
    // Upstream errors may embed access tokens or presigned COS URLs in their
    // message/stack. Keep only diagnostic identifiers in persistent logs.
    if (error) console.error({
      name: typeof error?.name === "string" ? error.name : "UnknownError",
      code: typeof error?.code === "string" ? error.code : undefined,
    });
  },
};

function format(level, message) {
  return `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
}
