import http from "node:http";
import type { HealthStatus } from "@ai-archaeologist/shared";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";
import type { WorkerLogger } from "./logger.js";

export function startHealthServer(
  port: number,
  logger: WorkerLogger,
  dependencies: { prisma: PrismaClient; redis: Redis },
): http.Server {
  const server = http.createServer((request, response) => {
    if (request.url === "/healthz") {
      void respondToHealthCheck(response, logger, dependencies);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });

  server.listen(port, () => {
    logger.info({ port }, "worker health server listening");
  });

  return server;
}

async function respondToHealthCheck(
  response: http.ServerResponse,
  logger: WorkerLogger,
  dependencies: { prisma: PrismaClient; redis: Redis },
): Promise<void> {
  try {
    await Promise.all([dependencies.prisma.$queryRaw`SELECT 1`, dependencies.redis.ping()]);
    const payload: HealthStatus = {
      service: "worker",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  } catch (error) {
    logger.error({ err: error }, "worker health check failed");
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ service: "worker", status: "unavailable" }));
  }
}
