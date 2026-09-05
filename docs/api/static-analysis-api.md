# Static Analysis API

Phase 04 endpoints for graph and analysis artifacts.

## Graph Summary

- `GET /repositories/:repositoryId/snapshots/:snapshotId/graph`

Returns dependency graph diagram metadata, symbol count, edge count, and persisted metrics.

Repository detail (`GET /repositories/:repositoryId`) now includes `latestAnalysisRun`.

## Internal AI Service

- `POST /internal/analysis/static`

Worker-only endpoint protected by signed internal job tokens. Performs Tree-sitter parsing, import extraction, package dependency detection, chunk generation, and graph construction.
