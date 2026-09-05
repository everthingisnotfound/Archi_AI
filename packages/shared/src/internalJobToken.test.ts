import { describe, expect, it } from "vitest";
import { signInternalJobToken } from "./internalJobToken.js";

describe("signInternalJobToken", () => {
  it("creates a three-part HMAC token", () => {
    const token = signInternalJobToken("analysis-run-1", "x".repeat(32), 2_000_000_000);
    expect(token.split(".")).toHaveLength(3);
    expect(token.startsWith("analysis-run-1.2000000000.")).toBe(true);
  });
});
