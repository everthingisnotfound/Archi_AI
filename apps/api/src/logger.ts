import pino from "pino";
import { apiConfig } from "./config.js";

export type AppLogger = pino.Logger;

export function createLogger(name: string): AppLogger {
  return pino({
    base: null,
    level: apiConfig.NODE_ENV === "test" ? "silent" : "info",
    name,
    redact: {
      paths: ["*.password", "*.token", "*.secret", "*.authorization", "*.cookie"],
      remove: true,
    },
  });
}
