import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { AppError, ErrorCode } from "@ai-archaeologist/shared";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const scryptParams = {
  N: 16_384,
  maxmem: 64 * 1024 * 1024,
  p: 1,
  r: 8,
} satisfies ScryptOptions;

const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(password, salt, keyLength, scryptParams);
  return [
    "scrypt",
    "v=1",
    `n=${scryptParams.N}`,
    `r=${scryptParams.r}`,
    `p=${scryptParams.p}`,
    salt,
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, version, cost, blockSize, parallelization, salt, hash] = storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    version !== "v=1" ||
    !cost?.startsWith("n=") ||
    !blockSize?.startsWith("r=") ||
    !parallelization?.startsWith("p=") ||
    !salt ||
    !hash
  ) {
    throw new AppError({
      code: ErrorCode.InvalidCredentials,
      message: "Invalid credentials.",
      statusCode: 401,
    });
  }

  const expected = Buffer.from(hash, "base64url");
  const derived = await scryptAsync(password, salt, expected.length, {
    N: Number.parseInt(cost.slice(2), 10),
    maxmem: scryptParams.maxmem,
    p: Number.parseInt(parallelization.slice(2), 10),
    r: Number.parseInt(blockSize.slice(2), 10),
  });

  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

