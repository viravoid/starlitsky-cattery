export const logger = {
  info(message) {
    console.log(format("info", message));
  },
  warn(message) {
    console.warn(format("warn", message));
  },
  error(message, error) {
    console.error(format("error", message));
    if (error) console.error(error);
  }
};

function format(level, message) {
  return `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
}
