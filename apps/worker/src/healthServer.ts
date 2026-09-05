import http from "node:http";
import type { HealthStatus } from "@ai-archaeologist/shared";
import type { WorkerLogger } from "./logger.js";

export function startHealthServer(port: number, logger: WorkerLogger): http.Server {
  const server = http.createServer((request, response) => {
    if (request.url === "/healthz") {
      const payload: HealthStatus = {
        service: "worker",
        status: "ok",
        timestamp: new Date().toISOString(),
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
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

