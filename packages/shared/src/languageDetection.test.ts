import { describe, expect, it } from "vitest";
import {
  detectLanguageFromPath,
  detectTechnologiesFromPaths,
  shouldExcludeRepositoryPath,
} from "./languageDetection.js";

describe("detectLanguageFromPath", () => {
  it("maps common source extensions", () => {
    expect(detectLanguageFromPath("src/index.ts")).toBe("typescript");
    expect(detectLanguageFromPath("main.py")).toBe("python");
    expect(detectLanguageFromPath("README.md")).toBe("markdown");
  });

  it("returns undefined for unknown extensions", () => {
    expect(detectLanguageFromPath("LICENSE")).toBeUndefined();
  });
});

describe("detectTechnologiesFromPaths", () => {
  it("detects manifests in the repository tree", () => {
    expect(
      detectTechnologiesFromPaths(["package.json", "vite.config.ts", "prisma/schema.prisma"]),
    ).toEqual(["nodejs", "prisma", "vite"]);
  });
});

describe("shouldExcludeRepositoryPath", () => {
  it("excludes dependency and build directories", () => {
    expect(shouldExcludeRepositoryPath("node_modules/react/index.js")).toBe(true);
    expect(shouldExcludeRepositoryPath("src/index.ts")).toBe(false);
  });
});
