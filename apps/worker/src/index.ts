import { parseRedisConnectionOptions } from "@ai-archaeologist/config";
import { createPrismaClient } from "@ai-archaeologist/database";
import {
  deepAnalysisQueueName,
  analysisQueueName,
  enrichmentQueueName,
  ingestionQueueName,
} from "@ai-archaeologist/shared";
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
    if (job) {
      void markDatabaseJobFailed(queueName, job.data, error).catch((persistenceError) => {
        logger.error(
          { err: persistenceError, jobId: job.id, queue: queueName },
          "failed to persist terminal job state",
        );
      });
    }
  });
}

async function markDatabaseJobFailed(
  queueName: string,
  data: unknown,
  error: Error,
): Promise<void> {
  const payload = data as {
    analysisRunId?: string;
    ingestionJobId?: string;
  };
  const failureMessage = error.message.slice(0, 500);

  if (queueName === ingestionQueueName && payload.ingestionJobId) {
    await prisma.ingestionJob.updateMany({
      data: {
        completedAt: new Date(),
        failureCode: "WORKER_JOB_FAILED",
        failureMessage,
        status: "FAILED",
      },
      where: {
        id: payload.ingestionJobId,
        status: {
          not: "SUCCEEDED",
        },
      },
    });
    return;
  }

  if (
    (queueName === analysisQueueName || queueName === deepAnalysisQueueName) &&
    payload.analysisRunId
  ) {
    await prisma.analysisRun.updateMany({
      data: {
        completedAt: new Date(),
        stage: "FAILED",
        status: "FAILED",
      },
      where: {
        id: payload.analysisRunId,
        status: {
          not: "SUCCEEDED",
        },
      },
    });
  }
}

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, ignoring signal");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "worker shutting down gracefully");

  // Close health server immediately
  healthServer.close();

  // Close workers in parallel (stops accepting new jobs, waits for in-flight to complete)
  const workerCloseTimeout = setTimeout(() => {
    logger.warn("Worker close timeout exceeded, forcing shutdown");
    process.exit(1);
  }, 30000); // 30s timeout

  try {
    await Promise.all([
      ingestionWorker.close(),
      analysisWorker.close(),
      enrichmentWorker.close(),
      deepAnalysisWorker.close(),
    ]);

    // Close publishers and redis
    await Promise.all([
      analysisJobPublisher.close(),
      enrichmentJobPublisher.close(),
      healthRedis.quit(),
    ]);

    // Disconnect prisma
    await prisma.$disconnect();

    clearTimeout(workerCloseTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(workerCloseTimeout);
    logger.error({ err: error }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  process.exit(1);
});
