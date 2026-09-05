import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { AppError, ErrorCode } from "@ai-archaeologist/shared";

export type GithubCloneResult = {
  commitSha: string;
  defaultBranch: string;
};

export async function cloneGithubRepository(
  url: string,
  targetDirectory: string,
  options: {
    depth: number;
    timeoutMs: number;
  },
): Promise<GithubCloneResult> {
  await rm(targetDirectory, { force: true, recursive: true });
  await runGit(
    ["clone", "--depth", String(options.depth), "--single-branch", url, targetDirectory],
    options.timeoutMs,
  );

  const commitSha = (await runGit(["rev-parse", "HEAD"], options.timeoutMs, targetDirectory)).trim();
  const defaultBranch = (
    await runGit(["rev-parse", "--abbrev-ref", "HEAD"], options.timeoutMs, targetDirectory)
  ).trim();

  await rm(`${targetDirectory}/.git`, { force: true, recursive: true });
  return { commitSha, defaultBranch };
}

function runGit(args: string[], timeoutMs: number, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new AppError({
          code: ErrorCode.ServiceUnavailable,
          message: "Git clone timed out.",
          statusCode: 504,
        }),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new AppError({
          code: ErrorCode.InvalidInput,
          message: stderr.trim() || "Git clone failed.",
          statusCode: 400,
        }),
      );
    });
  });
}
