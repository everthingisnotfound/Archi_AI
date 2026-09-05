from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.ai_config import is_completion_configured
from app.config import Settings
from app.providers.base import CompletionRequest
from app.providers.factory import create_completion_provider
from app.analysis.site_analyzer import load_site_profile


class DeepAnalysisFinding(BaseModel):
    title: str
    severity: str
    description: str


class DeepAnalysisRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    analysis_run_id: str = Field(alias="analysisRunId")
    organization_id: str = Field(alias="organizationId")
    repository_id: str = Field(alias="repositoryId")
    repository_name: str = Field(alias="repositoryName")
    snapshot_id: str = Field(alias="snapshotId")
    languages: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    findings: list[DeepAnalysisFinding] = Field(default_factory=list)
    graph_edges: list[dict[str, str]] = Field(default_factory=list, alias="graphEdges")
    context_excerpt: str = Field(default="", alias="contextExcerpt")


class DeepAnalysisResponse(BaseModel):
    content_markdown: str
    model: str
    prompt_tokens: int
    completion_tokens: int


async def complete_deep_analysis(settings: Settings, request: DeepAnalysisRequest) -> DeepAnalysisResponse:
    repository_root = Path(settings.workspace_root) / "snapshots" / request.snapshot_id / "repo"
    site_profile = load_site_profile(repository_root)
    profile_text = json.dumps(site_profile, indent=2)[:8000] if site_profile else "No live-site profile in this snapshot."
    findings_text = "\n".join(
        f"- [{finding.severity}] {finding.title}: {finding.description[:400]}"
        for finding in request.findings[:20]
    ) or "No security findings recorded."
    edges_text = "\n".join(
        f"- {edge.get('source', '?')} -> {edge.get('target', '?')} ({edge.get('type', 'edge')})"
        for edge in request.graph_edges[:40]
    ) or "No dependency edges recorded."

    if not is_completion_configured(settings):
        return DeepAnalysisResponse(
            content_markdown=(
                "# Deeper analysis unavailable\n\n"
                "Configure `GROQ_API_KEY` with `AI_PROVIDER=groq` (or `OPENAI_API_KEY`) "
                "to generate a walkthrough of the project, dependencies, and security controls."
            ),
            model="disabled",
            prompt_tokens=0,
            completion_tokens=0,
        )

    provider = create_completion_provider(settings)
    try:
        completion = await provider.complete(
            CompletionRequest(
                system=(
                    "You are a staff software archaeologist writing a trustworthy briefing. "
                    "Use only the supplied snapshot. If something is not observed, say it is unknown. "
                    "Never invent backend business logic, database schemas, or security features "
                    "that were not evidenced by headers, cookies, scripts, or source files. "
                    "For live websites, distinguish observed public behavior from guessed internals."
                ),
                prompt=(
                    f"Name: {request.repository_name}\n"
                    f"Languages: {', '.join(request.languages) or 'unknown'}\n"
                    f"Technologies: {', '.join(request.technologies) or 'unknown'}\n\n"
                    f"Live site profile:\n{profile_text}\n\n"
                    f"Dependency / resource edges:\n{edges_text}\n\n"
                    f"Security findings:\n{findings_text}\n\n"
                    f"Source excerpt:\n{request.context_excerpt[:7000]}\n\n"
                    "Write Markdown with these sections:\n"
                    "1. Project briefing — what this snapshot appears to be\n"
                    "2. Architecture surface — pages, assets, frameworks, third parties\n"
                    "3. Dependencies explained — each observed library/host/framework and why it is typically used\n"
                    "4. Security features in play — how observed headers, cookies, and CSP actually work; "
                    "what is missing; concrete hardening steps\n"
                    "5. Confidence and gaps — what this crawl or repo scan cannot know"
                ),
                temperature=0.15,
            )
        )
    except Exception as error:
        return DeepAnalysisResponse(
            content_markdown=(
                "# Deeper analysis failed\n\n"
                f"The AI provider could not complete the briefing: `{str(error)[:240]}`.\n\n"
                "Check `GROQ_API_KEY` / model quota, then retry."
            ),
            model="disabled",
            prompt_tokens=0,
            completion_tokens=0,
        )

    return DeepAnalysisResponse(
        content_markdown=completion.content,
        model=completion.model,
        prompt_tokens=completion.prompt_tokens,
        completion_tokens=completion.completion_tokens,
    )
