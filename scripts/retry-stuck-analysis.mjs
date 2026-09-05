import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

const analysisQueue = new Queue("repository-analysis", { connection });
const enrichmentQueue = new Queue("repository-enrichment", { connection });

for (const job of await enrichmentQueue.getFailed(0, 50)) {
  console.log("removing failed enrichment", job.id);
  await job.remove();
}

const stuckRuns = await prisma.analysisRun.findMany({
  where: {
    OR: [{ status: "FAILED" }, { status: "QUEUED" }, { stage: "FAILED" }],
  },
});

console.log("requeueing", stuckRuns.length);
for (const run of stuckRuns) {
  if (run.status === "SUCCEEDED" && run.stage === "COMPLETED") {
    continue;
  }
  await prisma.analysisRun.update({
    data: {
      completedAt: null,
      stage: "PARSING",
      status: "QUEUED",
    },
    where: { id: run.id },
  });
  await analysisQueue.add(
    "static-analysis",
    {
      analysisRunId: run.id,
      organizationId: run.organizationId,
      repositoryId: run.repositoryId,
      snapshotId: run.snapshotId,
    },
    { jobId: `${run.id}-retry-${Date.now()}` },
  );
  console.log("requeued", run.id);
}

await prisma.$disconnect();
await analysisQueue.close();
await enrichmentQueue.close();
await connection.quit();
