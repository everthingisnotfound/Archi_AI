import { intEnv, loadEnv, stringEnv } from "@ai-archaeologist/config";
import { repositoryLimitDefaults } from "@ai-archaeologist/shared";
import { z } from "zod";

export const workerConfig = loadEnv({
  DATABASE_URL: stringEnv("DATABASE_URL"),
  GITHUB_CLONE_DEPTH: intEnv(1),
  GITHUB_CLONE_TIMEOUT_MS: intEnv(120_000),
  MAX_REPOSITORY_BYTES: intEnv(repositoryLimitDefaults.maxRepositoryBytes),
  MAX_REPOSITORY_FILES: intEnv(repositoryLimitDefaults.maxRepositoryFiles),
  MAX_SINGLE_FILE_BYTES: intEnv(repositoryLimitDefaults.maxSingleFileBytes),
  MAX_UPLOAD_BYTES: intEnv(repositoryLimitDefaults.maxUploadBytes),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  WORKER_CONCURRENCY: intEnv(2),
  WORKER_HEALTH_PORT: intEnv(4100),
  WORKSPACE_ROOT: z.string().min(1).default("./data/workspaces"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  INTERNAL_JOB_TOKEN_SECRET: z.string().min(32),
});

export type WorkerConfig = typeof workerConfig;

