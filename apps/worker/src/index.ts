import { parseRedisConnectionOptions } from "@ai-archaeologist/config";
import { createPrismaClient } from "@ai-archaeologist/database";
import { deepAnalysisQueueName, analysisQueueName, enrichmentQueueName, ingestionQueueName } from "@ai-archaeologist/shared";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { createAnalysisProcessor } from "./analysis/analysisProcessor.js";
import { createDeepAnalysisProcessor } from "./analysis/deepAnalysisProcessor.js";
import { createEnrichmentProcessor } from "./analysis/enrichmentProcessor.js";
import { workerConfig } from "./config.js";
import { BullMqAnalysisJobPublisher } from "./jobs/analysisJobPublisher.js";
import { BullMqEnrichmentJobPublisher } from "./jobs/enrichmentJobPublisher.js";
import { startHealthServer } from "./healthServer.js";
import { createWorkerLogger } from "./logger.js";
import { createIngestionProcessor } from "./processor.js";

const logger = createWorkerLogger();
const prisma = createPrismaClient(workerConfig.DATABASE_URL);
const redisConnection = parseRedisConnectionOptions(workerConfig.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const healthRedis = new Redis(workerConfig.REDIS_URL, {
  maxRetriesPerRequest: 1,
});
const analysisJobPublisher = new BullMqAnalysisJobPublisher(redisConnection);
const enrichmentJobPublisher = new BullMqEnrichmentJobPublisher(redisConnection);
const railwayPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined;
const healthPort =
  railwayPort && railwayPort > 0 && railwayPort <= 65_535
    ? railwayPort
    : workerConfig.WORKER_HEALTH_PORT;
const healthServer = startHealthServer(healthPort, logger, {
  prisma,
  redis: healthRedis,
});

const ingestionWorker = new Worker(
  ingestionQueueName,
  createIngestionProcessor({
    analysisJobPublisher,
    config: workerConfig,
    logger,
    prisma,
  }),
  {
    concurrency: workerConfig.WORKER_CONCURRENCY,
    connection: redisConnection,
  },
);

const analysisWorker = new Worker(
  analysisQueueName,
  createAnalysisProcessor({
    config: workerConfig,
    enrichmentJobPublisher,
    logger,
    prisma,
  }),
  {
    concurrency: workerConfig.WORKER_CONCURRENCY,
    connection: redisConnection,
  },
);

const enrichmentWorker = new Worker(
  enrichmentQueueName,
  createEnrichmentProcessor({
    config: workerConfig,
    logger,
    prisma,
  }),
  {
    concurrency: workerConfig.WORKER_CONCURRENCY,
    connection: redisConnection,
  },
);

const deepAnalysisWorker = new Worker(
  deepAnalysisQueueName,
  createDeepAnalysisProcessor({
    config: workerConfig,
    logger,
    prisma,
  }),
  {
    concurrency: workerConfig.WORKER_CONCURRENCY,
    connection: redisConnection,
  },
);

for (const [queueName, workerInstance] of [
  [ingestionQueueName, ingestionWorker],
  [analysisQueueName, analysisWorker],
  [enrichmentQueueName, enrichmentWorker],
  [deepAnalysisQueueName, deepAnalysisWorker],
] as const) {
  workerInstance.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: queueName }, "job completed");
  });
  workerInstance.on("failed", (job, error) => {
    logger.error({ err: error, jobId: job?.id, queue: queueName }, "job failed");
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "worker shutting down");
  healthServer.close();
  await Promise.all([
    ingestionWorker.close(),
    analysisWorker.close(),
    enrichmentWorker.close(),
    deepAnalysisWorker.close(),
    analysisJobPublisher.close(),
    enrichmentJobPublisher.close(),
    healthRedis.quit(),
    prisma.$disconnect(),
  ]);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
