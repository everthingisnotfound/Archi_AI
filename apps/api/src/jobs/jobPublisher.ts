import {
  analysisQueueName,
  deepAnalysisQueueName,
  ingestionQueueName,
  type AnalysisJobPayload,
  type DeepAnalysisJobPayload,
  type IngestionJobPayload,
} from "@ai-archaeologist/shared";
import { Queue, type ConnectionOptions } from "bullmq";

export interface JobPublisher {
  enqueueAnalysis(payload: AnalysisJobPayload): Promise<void>;
  enqueueDeepAnalysis(payload: DeepAnalysisJobPayload): Promise<void>;
  enqueueIngestion(payload: IngestionJobPayload): Promise<void>;
}

export class BullMqJobPublisher implements JobPublisher {
  private readonly analysisQueue: Queue<AnalysisJobPayload, void, "static-analysis">;
  private readonly deepAnalysisQueue: Queue<DeepAnalysisJobPayload, void, "deep-analyze">;
  private readonly queue: Queue<IngestionJobPayload, void, "validate-source">;

  public constructor(connection: ConnectionOptions) {
    this.queue = new Queue<IngestionJobPayload, void, "validate-source">(ingestionQueueName, {
      connection,
    });
    this.analysisQueue = new Queue<AnalysisJobPayload, void, "static-analysis">(analysisQueueName, {
      connection,
    });
    this.deepAnalysisQueue = new Queue<DeepAnalysisJobPayload, void, "deep-analyze">(
      deepAnalysisQueueName,
      { connection },
    );
  }

  public async enqueueIngestion(payload: IngestionJobPayload): Promise<void> {
    await this.queue.add("validate-source", payload, {
      attempts: 3,
      backoff: {
        delay: 5_000,
        type: "exponential",
      },
      jobId: payload.ingestionJobId,
      removeOnComplete: {
        age: 86_400,
        count: 1_000,
      },
      removeOnFail: {
        age: 604_800,
      },
    });
  }

  public async enqueueAnalysis(payload: AnalysisJobPayload): Promise<void> {
    await this.analysisQueue.add("static-analysis", payload, {
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

  public async enqueueDeepAnalysis(payload: DeepAnalysisJobPayload): Promise<void> {
    await this.deepAnalysisQueue.add("deep-analyze", payload, {
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
    await Promise.all([this.queue.close(), this.analysisQueue.close(), this.deepAnalysisQueue.close()]);
  }
}
