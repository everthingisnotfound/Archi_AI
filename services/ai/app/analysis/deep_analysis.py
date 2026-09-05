"""Deep analysis endpoint — Threat Intelligence Briefing.

This module produces an adversarial security briefing when the user clicks
"Deeper analysis" on a repository snapshot. It uses the snapshot context
(symbols, dependencies, findings, site profile) to answer:
  "What would a competent attacker or competitor learn from cloning this?"
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.analysis.threat_briefing import (
    ThreatBriefingEdge,
    ThreatBriefingFinding,
    ThreatBriefingRequest,
    ThreatBriefingResponse,
    ThreatBriefingSymbol,
    generate_threat_briefing,
)
from app.config import Settings
from app.analysis.models import SnapshotFileDescriptor


# Keep the original alias-based field names so the worker client doesn't need changes.
class DeepAnalysisFinding(BaseModel):
    title: str
    severity: str
    description: str


class DeepAnalysisRequest(BaseModel):
    """Request shape accepted by the /internal/analysis/deep endpoint.

    Workers send snake_case field names; Pydantic maps them via aliases.
    """

    model_config = ConfigDict(populate_by_name=True)

    analysis_run_id: str = Field(alias="analysisRunId")
    organization_id: str = Field(alias="organizationId")
    repository_id: str = Field(alias="repositoryId")
    repository_name: str = Field(alias="repositoryName")
    snapshot_id: str = Field(alias="snapshotId")

    # Existing fields — carried through from prior version
    languages: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    findings: list[DeepAnalysisFinding] = Field(default_factory=list)
    graph_edges: list[dict[str, str]] = Field(default_factory=list, alias="graphEdges")
    context_excerpt: str = Field(default="", alias="contextExcerpt")

    # New fields — richer context for the threat briefing
    symbols: list[ThreatBriefingSymbol] = Field(default_factory=list)
    files: list[SnapshotFileDescriptor] = Field(default_factory=list)
    site_profile_json: str = Field(default="", alias="siteProfile")


class DeepAnalysisResponse(BaseModel):
    content_markdown: str
    model: str
    prompt_tokens: int
    completion_tokens: int


def _parse_site_profile(raw: str) -> dict | None:
    """Parse the optional site-profile JSON string sent by the worker."""
    import json

    if not raw:
        return None
    try:
        loaded = json.loads(raw)
        return loaded if isinstance(loaded, dict) else None
    except Exception:
        return None


async def complete_deep_analysis(settings: Settings, request: DeepAnalysisRequest) -> DeepAnalysisResponse:
    """Generate the Threat Intelligence Briefing for a snapshot."""
    site_profile = _parse_site_profile(request.site_profile_json)

    # Map the flat graph_edges list from the worker into ThreatBriefingEdge objects
    briefing_edges = [
        ThreatBriefingEdge(
            source=edge.get("source", ""),
            target=edge.get("target", ""),
            type=edge.get("type", "edge"),
        )
        for edge in request.graph_edges[:60]
    ]

    # Map findings into the briefing model
    briefing_findings = [
        ThreatBriefingFinding(
            title=f.title,
            severity=f.severity,
            description=f.description,
            path=None,
        )
        for f in request.findings[:24]
    ]

    briefing_request = ThreatBriefingRequest(
        analysis_run_id=request.analysis_run_id,
        organization_id=request.organization_id,
        repository_id=request.repository_id,
        repository_name=request.repository_name,
        snapshot_id=request.snapshot_id,
        languages=request.languages,
        technologies=request.technologies,
        symbols=request.symbols[:30],
        dependency_edges=briefing_edges,
        files=request.files,
        findings=briefing_findings,
        context_excerpt=request.context_excerpt,
    )

    result = await generate_threat_briefing(settings, briefing_request)

    return DeepAnalysisResponse(
        content_markdown=result.content_markdown,
        model=result.model,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )
