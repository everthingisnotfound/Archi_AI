import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { repositoryLimitDefaults } from "@ai-archaeologist/shared";
import { scanRepositoryDirectory } from "./repositoryScan.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("scanRepositoryDirectory", () => {
  it("indexes source files and detects languages and technologies", async () => {
    const repositoryRoot = await createFixture({
      "package.json": '{"name":"demo"}',
      "src/index.ts": "export const value = 1;",
    });

    const scan = await scanRepositoryDirectory(repositoryRoot, {
      MAX_REPOSITORY_BYTES: repositoryLimitDefaults.maxRepositoryBytes,
      MAX_REPOSITORY_FILES: repositoryLimitDefaults.maxRepositoryFiles,
      MAX_SINGLE_FILE_BYTES: repositoryLimitDefaults.maxSingleFileBytes,
    } as never);

    expect(scan.fileCount).toBe(2);
    expect(scan.languages).toContain("typescript");
    expect(scan.technologies).toContain("nodejs");
    expect(scan.files.map((file) => file.path).sort()).toEqual(["package.json", "src/index.ts"]);
  });

  it("skips excluded directories", async () => {
    const repositoryRoot = await createFixture({
      "node_modules/react/index.js": "ignored",
      "src/app.ts": "export {}",
    });

    const scan = await scanRepositoryDirectory(repositoryRoot, {
      MAX_REPOSITORY_BYTES: repositoryLimitDefaults.maxRepositoryBytes,
      MAX_REPOSITORY_FILES: repositoryLimitDefaults.maxRepositoryFiles,
      MAX_SINGLE_FILE_BYTES: repositoryLimitDefaults.maxSingleFileBytes,
    } as never);

    expect(scan.fileCount).toBe(1);
    expect(scan.files[0]?.path).toBe("src/app.ts");
  });
});

async function createFixture(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "archaeologist-scan-"));
  tempDirectories.push(directory);

  for (const [relativePath, content] of Object.entries(files)) {
    const destination = path.join(directory, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");
  }

  return directory;
}
