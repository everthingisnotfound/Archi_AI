# Phase 04 Static Analysis Plan

Status: complete.

This phase implements deterministic static analysis after repository ingestion: Tree-sitter parsing, symbol extraction, import and package dependency graphs, and deterministic code chunks.

## Objectives

- Persist snapshot workspaces for analysis after ingestion completes.
- Enqueue `AnalysisRun` jobs when ingestion succeeds.
- Call the FastAPI AI service with signed internal job tokens.
- Extract symbols, dependency edges, code chunks, and a dependency graph diagram.
- Persist analysis artifacts to PostgreSQL through the worker.
- Expose graph and analysis status APIs.
- Show analysis progress and graph summary in the repository detail UI.

## Non-Objectives

- Embedding generation and vector search.
- AI-generated explanations, chat, or documentation.
- Security findings and scoring engines beyond basic structural metrics.

## Deliverable

Phase 04 is complete when ingestion automatically triggers analysis, symbols and graphs are persisted, and the UI can display analysis completion with graph statistics.
