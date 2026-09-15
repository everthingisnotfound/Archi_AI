import { boolEnv, intEnv, loadEnv, stringEnv } from "@ai-archaeologist/config";
import { repositoryLimitDefaults } from "@ai-archaeologist/shared";
import { z } from "zod";

const portSchema = z
  .number()
  .int()
  .min(1)
  .max(65535)
  .refine((port) => port > 1023 || port === 80, {
    message: "Port must be > 1023 or exactly 80 (requires root for other privileged ports)",
  });

export const apiConfig = loadEnv({
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)).default("http://localhost:5173"),
  DATABASE_URL: stringEnv("DATABASE_URL"),
  INTERNAL_JOB_TOKEN_SECRET: z.string().min(32),
  MAX_REPOSITORY_BYTES: intEnv(repositoryLimitDefaults.maxRepositoryBytes),
  MAX_REPOSITORY_FILES: intEnv(repositoryLimitDefaults.maxRepositoryFiles),
  MAX_SINGLE_FILE_BYTES: intEnv(repositoryLimitDefaults.maxSingleFileBytes),
  MAX_UPLOAD_BYTES: intEnv(repositoryLimitDefaults.maxUploadBytes),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: intEnv(4000).pipe(portSchema),
  RATE_LIMIT_FAIL_CLOSED: boolEnv(true),
  RATE_LIMIT_MAX_REQUESTS: intEnv(120),
  RATE_LIMIT_WINDOW_SECONDS: intEnv(60),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SESSION_COOKIE_NAME: z.string().min(1).default("asa_session"),
  SESSION_SECRET: z.string().min(32),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  WORKSPACE_ROOT: z.string().min(1).default(process.env.NODE_ENV === "production" ? "/tmp/workspaces" : "./data/workspaces"),
});

export type ApiConfig = typeof apiConfig;
