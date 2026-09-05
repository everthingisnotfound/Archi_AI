import { deepAnalysisQueueName, type DeepAnalysisJobPayload } from "@ai-archaeologist/shared";
import { Queue, type ConnectionOptions } from "bullmq";

export interface DeepAnalysisJobPublisher {
  enqueueDeepAnalysis(payload: DeepAnalysisJobPayload): Promise<void>;
}

export class BullMqDeepAnalysisJobPublisher implements DeepAnalysisJobPublisher {
  private readonly queue: Queue<DeepAnalysisJobPayload, void, "deep-analyze">;

  public constructor(connection: ConnectionOptions) {
    this.queue = new Queue<DeepAnalysisJobPayload, void, "deep-analyze">(deepAnalysisQueueName, {
      connection,
    });
  }

  public async enqueueDeepAnalysis(payload: DeepAnalysisJobPayload): Promise<void> {
    await this.queue.add("deep-analyze", payload, {
      attempts: 2,
      backoff: {
        delay: 5_000,
        type: "exponential",
      },
      jobId: `${payload.snapshotId}-deep-analysis-${Date.now()}`,
      removeOnComplete: {
        age: 86_400,
        count: 1_000,
      },
      removeOnFail: {
        age: 604_800,
      },
    });
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}
