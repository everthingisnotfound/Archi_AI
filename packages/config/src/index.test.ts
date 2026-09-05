import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  intEnv,
  loadEnv,
  parseRedisConnectionOptions,
  redactConfig,
  stringEnv,
} from "./index.js";

describe("configuration loading", () => {
  it("parses typed environment values", () => {
    const env = loadEnv(
      {
        PORT: intEnv(4000),
        DATABASE_URL: stringEnv("DATABASE_URL"),
      },
      {
        PORT: "4100",
        DATABASE_URL: "postgresql://example",
      },
    );

    expect(env.PORT).toBe(4100);
    expect(env.DATABASE_URL).toBe("postgresql://example");
  });

  it("throws a safe error for invalid configuration", () => {
    expect(() =>
      loadEnv(
        {
          PORT: intEnv(4000),
        },
        {
          PORT: "not-a-number",
        },
      ),
    ).toThrow(ConfigurationError);
  });

  it("redacts sensitive keys", () => {
    expect(
      redactConfig({
        SESSION_SECRET: "super-secret",
        NODE_ENV: "test",
      }),
    ).toEqual({
      SESSION_SECRET: "[redacted]",
      NODE_ENV: "test",
    });
  });

  it("parses Redis URLs into connection options", () => {
    expect(parseRedisConnectionOptions("redis://user:pass@localhost:6380/2")).toEqual({
      db: 2,
      host: "localhost",
      password: "pass",
      port: 6380,
      username: "user",
    });
  });
});
