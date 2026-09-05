import { describe, expect, it } from "vitest";
import { normalizeRepositoryRelativePath } from "./pathSafety.js";

describe("repository path safety", () => {
  it("normalizes safe repository paths", () => {
    expect(normalizeRepositoryRelativePath("src\\index.ts")).toBe("src/index.ts");
  });

  it.each(["../secret", "/etc/passwd", "C:\\Windows\\system32", "safe/../../escape"])(
    "rejects unsafe path %s",
    (candidate) => {
      expect(() => normalizeRepositoryRelativePath(candidate)).toThrow();
    },
  );
});

