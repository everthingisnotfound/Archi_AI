from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SnapshotFileDescriptor(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    path: str
    size_bytes: int = Field(alias="sizeBytes")
    language: str | None = None


class StaticAnalysisRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: str = Field(alias="organizationId")
    repository_id: str = Field(alias="repositoryId")
    snapshot_id: str = Field(alias="snapshotId")
    files: list[SnapshotFileDescriptor]


class ExtractedSymbol(BaseModel):
    path: str
    name: str
    kind: str
    start_line: int
    end_line: int


class ExtractedEdge(BaseModel):
    source_ref: str
    target_ref: str
    edge_type: str


class ExtractedChunk(BaseModel):
    path: str
    start_line: int
    end_line: int
    text: str
    content_hash: str
    symbol_name: str | None = None


class StaticAnalysisResponse(BaseModel):
    symbols: list[ExtractedSymbol]
    edges: list[ExtractedEdge]
    chunks: list[ExtractedChunk]
    graph_json: dict[str, object]
    metrics: dict[str, float]
