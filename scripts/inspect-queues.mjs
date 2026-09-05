import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

const runs = await prisma.analysisRun.findMany({
  include: { repository: { select: { name: true } } },
  orderBy: { createdAt: "desc" },
  take: 12,
});
console.log(
  "runs",
  runs.map((run) => ({
    id: run.id,
    repo: run.repository?.name,
    status: run.status,
    stage: run.stage,
  })),
);

const jobs = await prisma.ingestionJob.findMany({
  include: { repository: { select: { name: true } } },
  orderBy: { createdAt: "desc" },
  take: 8,
});
console.log(
  "ingestion",
  jobs.map((job) => ({
    id: job.id,
    repo: job.repository?.name,
    status: job.status,
    progress: job.progress,
  })),
);

for (const name of ["repository-analysis", "repository-enrichment", "repository-ingestion"]) {
  const queue = new Queue(name, { connection });
  console.log(name, {
    waiting: await queue.getWaitingCount(),
    active: await queue.getActiveCount(),
    failed: await queue.getFailedCount(),
    completed: await queue.getCompletedCount(),
    delayed: await queue.getDelayedCount(),
  });
  for (const job of await queue.getFailed(0, 15)) {
    console.log("  failed", job.id, String(job.failedReason ?? "").slice(0, 240));
  }
  await queue.close();
}

await prisma.$disconnect();
await connection.quit();
