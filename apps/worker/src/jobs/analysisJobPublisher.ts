import { analysisQueueName, type AnalysisJobPayload } from "@ai-archaeologist/shared";
import { Queue, type ConnectionOptions } from "bullmq";

export interface AnalysisJobPublisher {
  enqueueAnalysis(payload: AnalysisJobPayload): Promise<void>;
}

export class BullMqAnalysisJobPublisher implements AnalysisJobPublisher {
  private readonly queue: Queue<AnalysisJobPayload, void, "static-analysis">;

  public constructor(connection: ConnectionOptions) {
    this.queue = new Queue<AnalysisJobPayload, void, "static-analysis">(analysisQueueName, {
      connection,
    });
  }

  public async enqueueAnalysis(payload: AnalysisJobPayload): Promise<void> {
    await this.queue.add("static-analysis", payload, {
      attempts: 3,
      backoff: {
        delay: 5_000,
        type: "exponential",
      },
      jobId: `${payload.analysisRunId}-static-${Date.now()}`,
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
