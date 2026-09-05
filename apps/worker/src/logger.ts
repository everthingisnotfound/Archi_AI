import pino from "pino";
import { workerConfig } from "./config.js";

export type WorkerLogger = pino.Logger;

export function createWorkerLogger(): WorkerLogger {
  return pino({
    base: null,
    level: workerConfig.NODE_ENV === "test" ? "silent" : "info",
    name: "worker",
    redact: {
      paths: ["*.password", "*.token", "*.secret", "*.authorization", "*.cookie"],
      remove: true,
    },
  });
}
