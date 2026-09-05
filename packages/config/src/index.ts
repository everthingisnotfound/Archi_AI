import { z } from "zod";

export type EnvSource = Record<string, string | undefined>;

export class ConfigurationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid configuration: ${issues.join("; ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

export function stringEnv(name: string): z.ZodEffects<z.ZodString, string, string> {
  return z.string().min(1, `${name} is required`).transform((value) => value.trim());
}

export function optionalStringEnv(): z.ZodOptional<z.ZodEffects<z.ZodString, string, string>> {
  return z
    .string()
    .transform((value) => value.trim())
    .optional();
}

export function intEnv(defaultValue: number): z.ZodEffects<z.ZodDefault<z.ZodString>, number, string | undefined> {
  return z
    .string()
    .default(String(defaultValue))
    .transform((value, context) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(parsed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected an integer, received ${value}`,
        });
        return z.NEVER;
      }
      return parsed;
    });
}

export function boolEnv(defaultValue: boolean): z.ZodEffects<z.ZodDefault<z.ZodString>, boolean, string | undefined> {
  return z
    .string()
    .default(String(defaultValue))
    .transform((value, context) => {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no"].includes(normalized)) {
        return false;
      }
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Expected a boolean, received ${value}`,
      });
      return z.NEVER;
    });
}

export function loadEnv<TShape extends z.ZodRawShape>(
  shape: TShape,
  source: EnvSource = process.env,
): z.infer<z.ZodObject<TShape>> {
  const parsed = z.object(shape).safeParse(source);

  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    );
  }

  return parsed.data;
}

const secretNameFragments = ["secret", "token", "password", "key", "credential"];

export function redactConfig(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const shouldRedact = secretNameFragments.some((fragment) =>
        key.toLowerCase().includes(fragment),
      );
      return [key, shouldRedact && value !== undefined && value !== "" ? "[redacted]" : value];
    }),
  );
}

export type RedisConnectionOptions = {
  db?: number;
  host: string;
  maxRetriesPerRequest?: number | null;
  password?: string;
  port: number;
  username?: string;
};

export function parseRedisConnectionOptions(
  redisUrl: string,
  overrides: Partial<RedisConnectionOptions> = {},
): RedisConnectionOptions {
  const parsed = new URL(redisUrl);
  const dbPath = parsed.pathname.replace("/", "");
  const db = dbPath ? Number.parseInt(dbPath, 10) : undefined;
  const options: RedisConnectionOptions = {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    ...overrides,
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  if (db !== undefined && Number.isSafeInteger(db)) {
    options.db = db;
  }

  return options;
}
