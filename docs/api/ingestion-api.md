# Ingestion API

Phase 03 read endpoints for repository ingestion status and snapshot file inventory.

## Repository Detail

- `GET /repositories/:repositoryId`

Returns the repository, its latest ingestion job, and latest snapshot.

## Ingestion Job Status

- `GET /repositories/:repositoryId/jobs/:jobId`

Returns ingestion progress, failure details, and result metadata including `snapshotId` when successful.

## Snapshot Files

- `GET /repositories/:repositoryId/snapshots/:snapshotId/files?cursor=&limit=`

Returns paginated file nodes for a snapshot ordered by path.

## Write Endpoints

The folder upload endpoint now accepts multipart form data:

- `displayName`
- repeated `files`
- repeated `paths` aligned with each uploaded file

ZIP uploads are persisted to the shared workspace before the ingestion job is enqueued.

GitHub ingestion jobs clone the repository in the worker, scan the tree, and create a snapshot.
