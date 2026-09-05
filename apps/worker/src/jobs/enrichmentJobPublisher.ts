import { enrichmentQueueName, type EnrichmentJobPayload } from "@ai-archaeologist/shared";
import { Queue, type ConnectionOptions } from "bullmq";

export interface EnrichmentJobPublisher {
  enqueueEnrichment(payload: EnrichmentJobPayload): Promise<void>;
}

export class BullMqEnrichmentJobPublisher implements EnrichmentJobPublisher {
  private readonly queue: Queue<EnrichmentJobPayload, void, "enrich-snapshot">;

  public constructor(connection: ConnectionOptions) {
    this.queue = new Queue<EnrichmentJobPayload, void, "enrich-snapshot">(enrichmentQueueName, {
      connection,
    });
  }

  public async enqueueEnrichment(payload: EnrichmentJobPayload): Promise<void> {
    const stableJobId = `${payload.analysisRunId}-enrichment`;
    const existing = await this.queue.getJob(stableJobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "active" || state === "waiting" || state === "delayed") {
        return;
      }
    }

    await this.queue.add("enrich-snapshot", payload, {
      attempts: 3,
      backoff: {
        delay: 5_000,
        type: "exponential",
      },
      jobId: stableJobId,
      removeOnComplete: {
        age: 86_400,
        count: 1_000,
      },
      removeOnFail: {
        age: 86_400,
      },
    });
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}
