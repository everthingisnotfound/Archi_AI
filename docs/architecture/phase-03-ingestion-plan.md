# Phase 03 Repository Ingestion Plan

Status: complete.

This phase implements real repository ingestion from the Phase 01 ingestion pipeline (steps 4–8). It prepares immutable snapshots for later static analysis, AI interpretation, and Mythos-style deep codebase understanding.

## Objectives

- Persist uploaded ZIP archives and folder files in a shared staging workspace.
- Clone GitHub repositories with bounded depth, timeout, and host allowlisting.
- Safely extract archives with path traversal, symlink, depth, and size limits.
- Scan staged repositories for file inventory, languages, and technology manifests.
- Create `RepositorySnapshot` and `FileNode` records.
- Expose repository detail, job status, and snapshot file APIs.
- Add repository detail UI with ingestion progress and file tree preview.

## Non-Objectives

- Tree-sitter parsing and symbol extraction (Phase 04).
- Graph construction and diagram generation (Phase 04).
- AI provider calls, embeddings, chat, or documentation (Phase 05+).
- Security findings and scoring engines (Phase 05+).

## Implementation Units

1. Shared workspace contracts
   - `WORKSPACE_ROOT` configuration for API and worker.
   - Staging paths keyed by `RepositorySource.id`.
   - Job workspace paths keyed by `IngestionJob.id`.

2. API staging
   - Persist ZIP archives before job enqueue.
   - Accept folder uploads as multipart file payloads with normalized relative paths.
   - Clean staging metadata in source records.

3. Worker retrieval
   - GitHub: shallow clone into isolated job workspace.
   - ZIP: safe extraction from staging.
   - Folder: copy validated files from staging.

4. Worker scanning
   - Walk repository tree with standard exclusion rules.
   - Detect languages by extension.
   - Detect technology manifests (`package.json`, `pyproject.toml`, etc.).
   - Compute repository content hash.

5. Snapshot persistence
   - Create `RepositorySnapshot` with commit SHA (GitHub) or content hash.
   - Bulk insert `FileNode` rows.
   - Update `Repository.defaultBranch` when available.

6. Read APIs
   - `GET /repositories/:repositoryId`
   - `GET /repositories/:repositoryId/jobs/:jobId`
   - `GET /repositories/:repositoryId/snapshots/:snapshotId/files`

7. Web repository detail
   - Poll ingestion job status.
   - Display languages, technologies, and file tree after success.

## Review Gates

Security review:

- ZIP extraction rejects path traversal, symlinks, and depth violations.
- Folder paths are normalized before write.
- GitHub clone uses HTTPS allowlist only with bounded timeout.
- Workspace paths never escape configured roots.

Performance review:

- File tree pagination on read APIs.
- Batch file node inserts during snapshot creation.
- Job workspaces cleaned after completion.

## Deliverable

Phase 03 is complete when a GitHub URL, ZIP upload, or folder upload produces a persisted snapshot with file nodes, visible job progress in the UI, and passing tests for extraction safety and repository scanning.
