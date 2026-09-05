from __future__ import annotations

from collections import Counter
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.ai_config import is_completion_configured, is_embedding_configured
from app.analysis.models import SnapshotFileDescriptor
from app.analysis.secret_scanner import SecretFinding, scan_repository_for_secrets
from app.analysis.site_analyzer import extract_site_findings, load_site_profile
from app.config import Settings
from app.providers.base import CompletionRequest
from app.providers.factory import create_completion_provider
from app.providers.openai_provider import embed_texts


class EnrichmentChunk(BaseModel):
    id: str
    path: str
    text: str


class EnrichmentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    analysis_run_id: str = Field(alias="analysisRunId")
    organization_id: str = Field(alias="organizationId")
    repository_id: str = Field(alias="repositoryId")
    repository_name: str = Field(alias="repositoryName")
    snapshot_id: str = Field(alias="snapshotId")
    chunks: list[EnrichmentChunk]
    files: list[SnapshotFileDescriptor]
    languages: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class ChunkEmbedding(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    vector: list[float]

    model_config = ConfigDict(populate_by_name=True)


class EnrichmentFinding(BaseModel):
    path: str
    title: str
    description: str
    severity: str
    category: str
    start_line: int
    end_line: int
    risk_explanation: str = ""
    remediation: str = ""


class EnrichmentResponse(BaseModel):
    embeddings: list[ChunkEmbedding]
    findings: list[EnrichmentFinding]
    summary_markdown: str
    embedded_count: int
    ai_enabled: bool


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=32)


class EmbeddingResponse(BaseModel):
    embeddings: list[list[float]]


class ChatContextChunk(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    path: str
    start_line: int = Field(alias="startLine")
    end_line: int = Field(alias="endLine")
    text: str


class ChatCompletionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    repository_name: str = Field(alias="repositoryName")
    context_chunks: list[ChatContextChunk] = Field(alias="contextChunks")

    model_config = ConfigDict(populate_by_name=True)


class ChatCompletionResponse(BaseModel):
    answer: str
    model: str
    prompt_tokens: int
    completion_tokens: int


MANIFEST_FILES = (
    "composer.json",
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "Gemfile",
    "pom.xml",
    "build.gradle",
    "Dockerfile",
    "docker-compose.yml",
    "index.php",
    "README.md",
)


def build_static_summary(
    request: EnrichmentRequest,
    secret_findings: list[SecretFinding],
    site_profile: dict | None = None,
) -> str:
    language_counts = Counter(
        file_descriptor.language or "unknown" for file_descriptor in request.files
    )
    language_breakdown = ", ".join(
        f"{language} ({count})" for language, count in language_counts.most_common(8)
    )
    manifest_paths = [
        file_descriptor.path
        for file_descriptor in request.files
        if Path(file_descriptor.path).name in MANIFEST_FILES
    ]
    largest_files = sorted(request.files, key=lambda file: file.size_bytes, reverse=True)[:5]

    lines = [
        f"# {request.repository_name}",
        "",
        "## Snapshot overview",
        "",
        f"- **Indexed files:** {len(request.files)}",
        f"- **Languages:** {', '.join(request.languages) or language_breakdown or 'unknown'}",
        f"- **Technologies:** {', '.join(request.technologies) or 'none detected'}",
        f"- **Security findings:** {len(secret_findings)}",
        "",
    ]

    if site_profile:
        lines.extend(
            [
                "## Live site capture",
                "",
                f"- **URL:** {site_profile.get('startUrl', 'unknown')}",
                f"- **Title:** {site_profile.get('title', 'unknown')}",
                f"- **Pages captured:** {len(site_profile.get('pages') or [])}",
                f"- **Frameworks:** {', '.join(site_profile.get('frameworks') or []) or 'none detected'}",
                f"- **Third-party hosts:** {', '.join(site_profile.get('thirdParties') or []) or 'none'}",
                "",
            ]
        )
        description = str(site_profile.get("description") or "").strip()
        if description:
            lines.extend(["### Publisher description", "", description, ""])

    if manifest_paths:
        lines.extend(["## Key project files", ""])
        lines.extend(f"- `{path}`" for path in manifest_paths[:12])
        lines.append("")

    if largest_files:
        lines.extend(["## Largest source files", ""])
        for file_descriptor in largest_files:
            language = file_descriptor.language or "unknown"
            size_kb = max(1, round(file_descriptor.size_bytes / 1024))
            lines.append(f"- `{file_descriptor.path}` ({language}, {size_kb} KB)")
        lines.append("")

    if secret_findings:
        lines.extend(["## Security scan highlights", ""])
        for finding in secret_findings[:5]:
            lines.append(
                f"- **{finding.severity}** `{finding.path}:{finding.start_line}` — {finding.title}"
            )
        lines.append("")

    lines.extend(
        [
            "## Analysis notes",
            "",
            "This summary was generated from ingestion metadata and deterministic scans. "
            "Use **Deeper analysis** for an AI walkthrough of dependencies and observed security controls. "
            "Configure `GROQ_API_KEY` with `AI_PROVIDER=groq` (or `OPENAI_API_KEY`) "
            "for an AI-written architecture narrative and semantic search embeddings.",
        ]
    )

    return "\n".join(lines)


async def enrich_snapshot(settings: Settings, request: EnrichmentRequest) -> EnrichmentResponse:
    repository_root = (
        Path(settings.workspace_root) / "snapshots" / request.snapshot_id / "repo"
    )
    secret_findings = scan_repository_for_secrets(
        repository_root,
        [file_descriptor.path for file_descriptor in request.files],
    )
    site_profile = load_site_profile(repository_root)
    if site_profile is not None:
        secret_findings = [*secret_findings, *extract_site_findings(site_profile)]

    ai_enabled = False
    embeddings: list[ChunkEmbedding] = []
    summary_markdown = build_static_summary(request, secret_findings, site_profile)
    completion_error: str | None = None

    if is_completion_configured(settings) and (request.chunks or site_profile is not None):
        if is_embedding_configured(settings) and request.chunks:
            try:
                api_key = settings.openai_api_key.get_secret_value()  # type: ignore[union-attr]
                texts = [chunk.text[:8000] for chunk in request.chunks]
                vectors = await embed_texts(api_key, texts)
                embeddings = [
                    ChunkEmbedding(chunkId=chunk.id, vector=vector)
                    for chunk, vector in zip(request.chunks, vectors, strict=True)
                ]
            except Exception:
                embeddings = []

        try:
            provider = create_completion_provider(settings)
            context_preview = "\n\n".join(
                f"File `{chunk.path}` lines {chunk.text.count(chr(10)) + 1}:\n{chunk.text[:1200]}"
                for chunk in request.chunks[:8]
            )
            site_context = ""
            if site_profile is not None:
                site_context = (
                    "\n\nLive site profile JSON:\n"
                    + str(site_profile)[:6000]
                )
            completion = await provider.complete(
                CompletionRequest(
                    system=(
                        "You are a senior software archaeologist. Summarize the repository or live website "
                        "using only the supplied context. Do not invent files, APIs, or security controls "
                        "that are not supported by the context. For websites, describe the public surface "
                        "(stack hints, third-party scripts, captured pages), not hidden backend internals."
                    ),
                    prompt=(
                        f"Repository: {request.repository_name}\n"
                        f"Languages: {', '.join(request.languages)}\n"
                        f"Technologies: {', '.join(request.technologies)}\n\n"
                        f"Context:\n{context_preview}{site_context}\n\n"
                        "Write a concise README-style summary in Markdown."
                    ),
                )
            )
            summary_markdown = completion.content
            ai_enabled = True
        except Exception as error:
            completion_error = str(error)[:240]
            summary_markdown = build_static_summary(request, secret_findings, site_profile)
            if completion_error:
                summary_markdown += (
                    "\n\n> AI summary generation failed. "
                    f"Provider error: {completion_error}. "
                    "Verify your API key, model name, and provider quota."
                )

    return EnrichmentResponse(
        embeddings=embeddings,
        findings=[
            EnrichmentFinding(
                path=finding.path,
                title=finding.title,
                description=finding.description,
                severity=finding.severity,
                category=finding.category,
                start_line=finding.start_line,
                end_line=finding.end_line,
                risk_explanation=finding.risk_explanation,
                remediation=finding.remediation,
            )
            for finding in secret_findings
        ],
        summary_markdown=summary_markdown,
        embedded_count=len(embeddings),
        ai_enabled=ai_enabled,
    )


async def embed_text_batch(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not is_embedding_configured(settings):
        return []
    return await embed_texts(settings.openai_api_key.get_secret_value(), texts)  # type: ignore[union-attr]


async def complete_chat(settings: Settings, request: ChatCompletionRequest) -> ChatCompletionResponse:
    if not is_completion_configured(settings):
        return ChatCompletionResponse(
            answer=(
                "AI chat is unavailable because no completion provider is configured. "
                "Set `GROQ_API_KEY` with `AI_PROVIDER=groq`, or configure `OPENAI_API_KEY`. "
                "Ingest and static analysis results are still available."
            ),
            model="disabled",
            prompt_tokens=0,
            completion_tokens=0,
        )

    provider = create_completion_provider(settings)
    context = "\n\n".join(
        (
            f"[{chunk.path}:{chunk.start_line}-{chunk.end_line}]\n{chunk.text[:2000]}"
            for chunk in request.context_chunks
        )
    ) or "No retrieved code context was available."

    try:
        completion = await provider.complete(
            CompletionRequest(
                system=(
                    "You answer questions about a codebase using only the supplied retrieved context. "
                    "Cite file paths in your answer. If the context is insufficient, say so explicitly."
                ),
                prompt=(
                    f"Repository: {request.repository_name}\n\n"
                    f"Retrieved context:\n{context}\n\n"
                    f"Question: {request.question}"
                ),
            )
        )
    except Exception:
        return ChatCompletionResponse(
            answer=(
                "AI chat is temporarily unavailable because the configured AI provider "
                "could not complete the request. Check your API key and quota. "
                "Static analysis, file listings, and secret scanning are still available."
            ),
            model="disabled",
            prompt_tokens=0,
            completion_tokens=0,
        )

    return ChatCompletionResponse(
        answer=completion.content,
        model=completion.model,
        prompt_tokens=completion.prompt_tokens,
        completion_tokens=completion.completion_tokens,
    )
