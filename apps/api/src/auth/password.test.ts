import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a password without storing the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toContain("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse battery staple", hash)).resolves.toBe(false);
  });
});

