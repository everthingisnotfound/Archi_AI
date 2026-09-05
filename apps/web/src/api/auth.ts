import { z } from "zod";
import { apiRequest } from "./client.js";
import { authResponseSchema, meResponseSchema } from "./schemas.js";

export function getCurrentUser() {
  return apiRequest("/auth/me", {
    method: "GET",
    schema: meResponseSchema,
  });
}

export function login(input: { email: string; password: string }) {
  return apiRequest("/auth/login", {
    body: JSON.stringify(input),
    method: "POST",
    schema: authResponseSchema,
  });
}

export function register(input: {
  email: string;
  name: string;
  organizationName: string;
  password: string;
}) {
  return apiRequest("/auth/register", {
    body: JSON.stringify(input),
    method: "POST",
    schema: authResponseSchema,
  });
}

export function logout() {
  return apiRequest("/auth/logout", {
    method: "POST",
    schema: z.undefined(),
  });
}

