import { z } from "zod";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
let csrfToken: string | undefined;

const csrfResponseSchema = z.object({
  csrfToken: z.string().min(1),
});

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch(`${apiBaseUrl}/auth/csrf`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize a secure session token.");
  }

  csrfToken = csrfResponseSchema.parse(await response.json()).csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { schema: z.ZodType<T> },
): Promise<T> {
  const headers = new Headers(options.headers);
  const method = options.method?.toUpperCase() ?? "GET";

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await ensureCsrfToken());
  }

  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    const message = parseApiErrorMessage(payload);
    throw new Error(message);
  }

  if (response.status === 204) {
    return options.schema.parse(undefined);
  }

  return options.schema.parse(await response.json());
}

function parseApiErrorMessage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return "Request failed.";
  }

  const error = (payload).error;
  if (typeof error !== "object" || error === null) {
    return "Request failed.";
  }

  const message =
    "message" in error && typeof error.message === "string" ? error.message : "Request failed.";

  if ("details" in error && Array.isArray(error.details) && error.details.length > 0) {
    const detailMessages = error.details
      .map((detail) => {
        if (typeof detail !== "object" || detail === null) {
          return null;
        }

        const detailMessage =
          "message" in detail && typeof detail.message === "string" ? detail.message : null;
        const path = "path" in detail && typeof detail.path === "string" ? detail.path : null;

        if (!detailMessage) {
          return null;
        }

        return path ? `${path}: ${detailMessage}` : detailMessage;
      })
      .filter((value): value is string => value !== null);

    if (detailMessages.length > 0) {
      return detailMessages.join(" ");
    }
  }

  return message;
}

