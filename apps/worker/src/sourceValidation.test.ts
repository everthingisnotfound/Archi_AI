import { describe, expect, it } from "vitest";
import type { WorkerConfig } from "./config.js";
import { validateRepositorySource } from "./sourceValidation.js";

const config = {
  AI_SERVICE_URL: "http://localhost:8000",
  DATABASE_URL: "postgresql://example",
  GITHUB_CLONE_DEPTH: 1,
  GITHUB_CLONE_TIMEOUT_MS: 120_000,
  INTERNAL_JOB_TOKEN_SECRET: "x".repeat(32),
  MAX_REPOSITORY_BYTES: 1000,
  MAX_REPOSITORY_FILES: 10,
  MAX_SINGLE_FILE_BYTES: 500,
  MAX_UPLOAD_BYTES: 500,
  NODE_ENV: "test",
  REDIS_URL: "redis://localhost:6379",
  WORKER_CONCURRENCY: 1,
  WORKER_HEALTH_PORT: 4100,
  WORKSPACE_ROOT: "./data/workspaces",
} satisfies WorkerConfig;

describe("source validation", () => {
  it("accepts a valid GitHub source", () => {
    expect(() => {
      validateRepositorySource(
        {
          metadata: {},
          type: "GITHUB",
          uri: "https://github.com/openai/codex",
        },
        config,
      );
    }).not.toThrow();
  });

  it("rejects non-GitHub URLs", () => {
    expect(() => {
      validateRepositorySource(
        {
          metadata: {},
          type: "GITHUB",
          uri: "https://example.com/openai/codex",
        },
        config,
      );
    }).toThrow();
  });

  it("accepts a public website source", () => {
    expect(() => {
      validateRepositorySource(
        {
          metadata: {},
          type: "WEBSITE",
          uri: "https://www.flipkart.com/",
        },
        config,
      );
    }).not.toThrow();
  });

  it("rejects private website URLs", () => {
    expect(() => {
      validateRepositorySource(
        {
          metadata: {},
          type: "WEBSITE",
          uri: "http://127.0.0.1/",
        },
        config,
      );
    }).toThrow();
  });

  it("enforces ZIP upload limits", () => {
    expect(() => {
      validateRepositorySource(
        {
          metadata: {
            originalName: "repo.zip",
            sha256: "a".repeat(64),
            sizeBytes: 501,
          },
          type: "ZIP",
          uri: null,
        },
        config,
      );
    }).toThrow();
  });
});
