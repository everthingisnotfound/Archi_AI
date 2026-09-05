import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
});

async function main() {
  const failedRuns = await prisma.analysisRun.findMany({
    where: { status: "FAILED" },
  });

  if (failedRuns.length === 0) {
    console.log("No failed analysis run found.");
    return;
  }

  const queue = new Queue("repository-analysis", { connection });

  for (const failedRun of failedRuns) {
    await prisma.analysisRun.update({
      data: {
        completedAt: null,
        stage: "PARSING",
        status: "QUEUED",
      },
      where: { id: failedRun.id },
    });

    await queue.add(
      "static-analysis",
      {
        analysisRunId: failedRun.id,
        organizationId: failedRun.organizationId,
        repositoryId: failedRun.repositoryId,
        snapshotId: failedRun.snapshotId,
      },
      {
        jobId: `${failedRun.id}-retry-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    console.log(`Re-queued analysis run ${failedRun.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await connection.quit();
  });
