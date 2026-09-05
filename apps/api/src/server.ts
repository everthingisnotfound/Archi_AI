import { parseRedisConnectionOptions } from "@ai-archaeologist/config";
import { createPrismaClient } from "@ai-archaeologist/database";
import { Redis } from "ioredis";
import { createApiApp } from "./app.js";
import { apiConfig } from "./config.js";
import { BullMqJobPublisher } from "./jobs/jobPublisher.js";
import { createLogger } from "./logger.js";

const logger = createLogger("api");
const redis = new Redis(apiConfig.REDIS_URL, {
  maxRetriesPerRequest: 3,
});
const prisma = createPrismaClient(apiConfig.DATABASE_URL);
const jobPublisher = new BullMqJobPublisher(parseRedisConnectionOptions(apiConfig.REDIS_URL));
const app = createApiApp({
  config: apiConfig,
  jobPublisher,
  logger,
  prisma,
  redis,
});

const server = app.listen(apiConfig.PORT, () => {
  logger.info({ port: apiConfig.PORT }, "api listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "api shutting down");
  server.close(async () => {
    await Promise.all([prisma.$disconnect(), redis.quit(), jobPublisher.close()]);
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
