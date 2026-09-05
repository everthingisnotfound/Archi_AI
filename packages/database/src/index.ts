import { PrismaClient } from "@prisma/client";

let singleton: PrismaClient | undefined;

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : [
            {
              emit: "event",
              level: "error",
            },
          ],
  });
}

export function getPrismaClient(): PrismaClient {
  singleton ??= createPrismaClient();
  return singleton;
}

export async function disconnectPrisma(): Promise<void> {
  if (singleton) {
    await singleton.$disconnect();
    singleton = undefined;
  }
}

export { PrismaClient };
