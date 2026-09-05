"""Threat Intelligence Briefing generation for the Deeper Analysis feature.

This module produces an adversarial analysis of a snapshot — answering
"what would a competent attacker or competitor learn from cloning this?"
in a structured, actionable form. All assessment is *structural*: it
consumes only what the snapshot already contains (parsed symbols,
dependencies, secret findings, captured site profile). No external
CVE lookups, no live vulnerability databases.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.ai_config import is_completion_configured
from app.analysis.models import SnapshotFileDescriptor
from app.analysis.site_analyzer import load_site_profile
from app.config import Settings
from app.providers.base import CompletionRequest
from app.providers.factory import create_completion_provider


class ThreatBriefingSymbol(BaseModel):
    name: str
    kind: str
    path: str
    start_line: int = Field(alias="startLine")
    end_line: int = Field(alias="endLine")

    model_config = ConfigDict(populate_by_name=True)


class ThreatBriefingEdge(BaseModel):
    source: str
    target: str
    type: str = "edge"


class ThreatBriefingFinding(BaseModel):
    title: str
    severity: str
    description: str
    path: str | None = None


class ThreatBriefingRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    analysis_run_id: str = Field(alias="analysisRunId")
    organization_id: str = Field(alias="organizationId")
    repository_id: str = Field(alias="repositoryId")
    repository_name: str = Field(alias="repositoryName")
    snapshot_id: str = Field(alias="snapshotId")

    languages: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    symbols: list[ThreatBriefingSymbol] = Field(default_factory=list)
    dependency_edges: list[ThreatBriefingEdge] = Field(default_factory=list, alias="dependencyEdges")
    files: list[SnapshotFileDescriptor] = Field(default_factory=list)
    findings: list[ThreatBriefingFinding] = Field(default_factory=list)
    context_excerpt: str = Field(default="", alias="contextExcerpt")


class ThreatBriefingResponse(BaseModel):
    content_markdown: str
    model: str
    prompt_tokens: int
    completion_tokens: int


# Configuration files that frequently disclose the operational reality
# of a project. Their presence in the snapshot is itself intelligence.
OPS_DISCLOSURE_FILES = {
    "docker-compose.yml",
    "docker-compose.yaml",
    "Dockerfile",
    ".env.example",
    ".github/workflows",
    ".gitlab-ci.yml",
    "Makefile",
    "terraform",
    "ansible",
    "k8s",
    "kubernetes",
}

# Patterns in symbols that suggest business-logic touchpoints —
# the functions a competitor or attacker would target first.
HIGH_VALUE_SYMBOL_KINDS = {
    "function",
    "method",
    "class",
    "interface",
    "route",
    "controller",
    "service",
    "handler",
    "schema",
    "model",
    "migration",
}

AUTH_RELATED_PATTERNS = (
    "auth",
    "login",
    "signin",
    "session",
    "jwt",
    "token",
    "password",
    "credential",
    "permission",
    "authorize",
    "rbac",
    "policy",
)

EXTERNAL_CALL_PATTERNS = (
    "fetch",
    "axios",
    "request",
    "http",
    "api_client",
    "stripe",
    "sendgrid",
    "twilio",
    "github",
    "oauth",
    "s3",
    "upload",
    "download",
)


def _summarise_files(files: list[SnapshotFileDescriptor]) -> dict[str, object]:
    """Produce a compact, intelligence-relevant summary of the file inventory."""
    language_counts = Counter(file.language or "unknown" for file in files)
    total_bytes = sum(file.size_bytes for file in files)
    manifests: list[str] = []
    ops_disclosures: list[str] = []
    config_files: list[str] = []
    largest_paths = sorted(files, key=lambda f: f.size_bytes, reverse=True)[:8]

    for file in files:
        name = Path(file.path).name.lower()
        # Manifest files: package.json, pyproject.toml, etc.
        if name in {
            "package.json",
            "composer.json",
            "requirements.txt",
            "pyproject.toml",
            "go.mod",
            "cargo.toml",
            "gemfile",
            "pom.xml",
            "build.gradle",
        }:
            manifests.append(file.path)
        # Ops disclosure: dockerfile, ci, infra files
        if name in {"dockerfile", "docker-compose.yml", "docker-compose.yaml", "makefile"}:
            ops_disclosures.append(file.path)
        if any(part in file.path.lower() for part in (".github/workflows", ".gitlab-ci.yml", "terraform", "ansible", "kubernetes", "k8s/")):
            ops_disclosures.append(file.path)
        if name.startswith(".env"):
            config_files.append(file.path)

    return {
        "total_files": len(files),
        "total_bytes": total_bytes,
        "language_breakdown": dict(language_counts.most_common(10)),
        "manifests": manifests[:12],
        "ops_disclosures": ops_disclosures[:12],
        "env_or_config_files": config_files[:12],
        "largest_files": [
            {"path": file.path, "size_bytes": file.size_bytes, "language": file.language}
            for file in largest_paths
        ],
    }


def _identify_high_value_symbols(symbols: list[ThreatBriefingSymbol]) -> list[dict[str, str]]:
    """Surface symbols an attacker or competitor would target first."""
    high_value: list[dict[str, str]] = []
    auth_related: list[dict[str, str]] = []
    external_call: list[dict[str, str]] = []

    for symbol in symbols:
        if symbol.kind.lower() not in HIGH_VALUE_SYMBOL_KINDS:
            continue
        lowered_name = symbol.name.lower()
        entry = {
            "name": symbol.name,
            "kind": symbol.kind,
            "path": symbol.path,
            "lines": f"{symbol.start_line}-{symbol.end_line}",
        }
        if any(pat in lowered_name for pat in AUTH_RELATED_PATTERNS):
            auth_related.append(entry)
        elif any(pat in lowered_name for pat in EXTERNAL_CALL_PATTERNS):
            external_call.append(entry)
        else:
            high_value.append(entry)

    return {
        "auth_related": auth_related[:12],
        "external_call": external_call[:12],
        "other_business_logic": high_value[:12],
    }


def _summarise_dependencies(
    edges: list[ThreatBriefingEdge],
    technologies: list[str],
) -> dict[str, object]:
    """Group dependencies by edge type and host to expose the supply chain."""
    by_type: Counter[str] = Counter()
    by_target: Counter[str] = Counter()
    third_parties: set[str] = set()

    for edge in edges:
        by_type[edge.type] += 1
        # For third-party or call edges, the target is a host or external service
        if edge.type in {"third_party", "external_call", "api", "service", "fetch"}:
            third_parties.add(edge.target)
        by_target[edge.target] += 1

    return {
        "edge_type_counts": dict(by_type.most_common(10)),
        "most_referenced_targets": [
            {"target": target, "reference_count": count}
            for target, count in by_target.most_common(15)
        ],
        "third_parties": sorted(third_parties)[:20],
        "declared_technologies": technologies,
    }


def build_threat_briefing_prompt(
    request: ThreatBriefingRequest,
    site_profile: dict | None,
) -> str:
    """Assemble the full prompt for the AI provider."""
    files_summary = _summarise_files(request.files)
    high_value = _identify_high_value_symbols(request.symbols)
    deps = _summarise_dependencies(request.dependency_edges, request.technologies)

    findings_text = (
        "\n".join(
            f"- [{f.severity}] {f.title}: {f.description[:300]}"
            for f in request.findings[:20]
        )
        or "No security findings recorded."
    )

    edges_text = (
        "\n".join(
            f"- {edge.source} -> {edge.target} ({edge.type})"
            for edge in request.dependency_edges[:30]
        )
        or "No dependency edges recorded."
    )

    site_text = (
        json.dumps(site_profile, indent=2)[:6000]
        if site_profile
        else "No live-site profile in this snapshot."
    )

    return (
        f"# Threat intelligence briefing for `{request.repository_name}`\n\n"
        f"## Snapshot context\n"
        f"- Languages: {', '.join(request.languages) or 'unknown'}\n"
        f"- Technologies: {', '.join(request.technologies) or 'unknown'}\n"
        f"- Total files: {files_summary['total_files']}\n"
        f"- Total size: {files_summary['total_bytes']} bytes\n\n"
        f"## File inventory summary\n"
        f"```json\n{json.dumps(files_summary, indent=2)[:4000]}\n```\n\n"
        f"## High-value symbols (what an attacker would target first)\n"
        f"```json\n{json.dumps(high_value, indent=2)[:4000]}\n```\n\n"
        f"## Dependency supply chain\n"
        f"```json\n{json.dumps(deps, indent=2)[:4000]}\n```\n\n"
        f"## Dependency edges (top 30)\n"
        f"{edges_text}\n\n"
        f"## Existing security findings\n"
        f"{findings_text}\n\n"
        f"## Live site profile (if any)\n"
        f"```json\n{site_text}\n```\n\n"
        f"## Source code excerpts\n"
        f"```\n{request.context_excerpt[:7000]}\n```\n\n"
        f"---\n\n"
        f"Write a **Threat Intelligence Briefing** in Markdown. "
        f"You are an adversarial security analyst who has been handed a clone of this "
        f"codebase. Be specific, not generic. Reference observed files, symbols, edges, "
        f"and findings. If something is not observed in the snapshot, say so explicitly. "
        f"Never invent controls, libraries, or business logic that are not in the context.\n\n"
        f"Use these exact sections, each one substantial:\n\n"
        f"## 1. Attack Surface Map\n"
        f"List every observed entry point: HTTP routes, exported functions, third-party "
        f"services, data flows, and trust boundaries. Group by surface (web, API, CLI, "
        f"internal). For each surface, name the specific files/symbols.\n\n"
        f"## 2. Competitive Intelligence Exposure\n"
        f"What does a competitor learn by cloning this repo? Identify what is plainly "
        f"visible: tech stack, business logic, ops practices, infrastructure hints, "
        f"vendor relationships. Flag anything that should not be public.\n\n"
        f"## 3. Dependency Risk Assessment\n"
        f"For the observed dependencies, group by structural risk: (a) packages that "
        f"are unmaintained or single-maintainer, (b) packages with broad permissions "
        f"(network, fs, exec), (c) supply chain attack surface (build-time deps, "
        f"postinstall scripts implied by ecosystem). Note this is structural, not CVE-based.\n\n"
        f"## 4. Security Gap Analysis\n"
        f"Compare what is observed against what a project of this stack *should* have. "
        f"Common gaps: missing rate limits on auth, no CSP/HSTS on web surface, secrets "
        f"in source, no input validation at trust boundaries, no audit logging, no "
        f"dependency lockfile, no CI security scanning, no backup/disaster story, no "
        f"key rotation story. Be specific about which gaps are present here.\n\n"
        f"## 5. Concrete Threat Scenarios\n"
        f"Write 3-5 specific attack paths as numbered scenarios. Each must be grounded "
        f"in the observed code or configuration — name the file, symbol, or finding. "
        f"Format each as: **Scenario N: [Name]** — actor, precondition, steps, impact. "
        f"Example: an attacker who controls [observed dependency] could [specific action] "
        f"because [observed code path].\n\n"
        f"## 6. Hardening Roadmap\n"
        f"List the top 5 actions ranked by impact, each as a checkbox. Each action must "
        f"reference a specific gap, finding, or surface from the sections above. "
        f"Format: `- [ ] **[Impact: CRITICAL|HIGH|MEDIUM]** Action — why`\n\n"
        f"## 7. Confidence and Unknowns\n"
        f"List what this analysis cannot know without runtime access: actual deployed "
        f"versions, runtime configuration, infrastructure topology, identity provider "
        f"details, secret values that may be in env vars not in source.\n\n"
        f"Keep the tone direct and technical. No marketing language. No hedging with "
        f"'consider' or 'you might want to'. Be specific."
    )


async def generate_threat_briefing(
    settings: Settings,
    request: ThreatBriefingRequest,
) -> ThreatBriefingResponse:
    """Generate the threat intelligence briefing for a snapshot."""
    repository_root = Path(settings.workspace_root) / "snapshots" / request.snapshot_id / "repo"
    site_profile = load_site_profile(repository_root)
    prompt = build_threat_briefing_prompt(request, site_profile)

    if not is_completion_configured(settings):
        return ThreatBriefingResponse(
            content_markdown=(
                "# Threat briefing unavailable\n\n"
                "Configure `GROQ_API_KEY` with `AI_PROVIDER=groq` (or `OPENAI_API_KEY`) "
                "to generate the adversarial threat briefing. "
                "Deterministic findings above still surface real issues — the briefing "
                "adds structured attack-surface, threat-scenario, and hardening-roadmap "
                "analysis grounded in the snapshot."
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
                    "You are an adversarial security analyst producing a threat intelligence "
                    "briefing on a codebase clone. You are direct, specific, and you never "
                    "fabricate. You only reference what is in the supplied snapshot context. "
                    "When something cannot be observed, you say so. You write in Markdown "
                    "with the exact section structure the user requested."
                ),
                prompt=prompt,
                temperature=0.2,
            )
        )
    except Exception as error:
        return ThreatBriefingResponse(
            content_markdown=(
                "# Threat briefing failed\n\n"
                f"The AI provider could not complete the briefing: `{str(error)[:240]}`.\n\n"
                "Check `GROQ_API_KEY` / model quota, then retry. "
                "The static security findings on this page remain available."
            ),
            model="disabled",
            prompt_tokens=0,
            completion_tokens=0,
        )

    return ThreatBriefingResponse(
        content_markdown=completion.content,
        model=completion.model,
        prompt_tokens=completion.prompt_tokens,
        completion_tokens=completion.completion_tokens,
    )
