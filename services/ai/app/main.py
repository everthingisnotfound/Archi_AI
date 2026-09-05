from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Body, Depends, FastAPI

from app.analysis.enrichment import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    EnrichmentRequest,
    EnrichmentResponse,
    complete_chat,
    embed_text_batch,
    enrich_snapshot,
)
from app.analysis.deep_analysis import DeepAnalysisRequest, DeepAnalysisResponse, complete_deep_analysis
from app.analysis.models import StaticAnalysisRequest, StaticAnalysisResponse
from app.analysis.static_analyzer import analyze_snapshot
from app.config import Settings, get_settings
from app.security import require_internal_job_token, verify_internal_job_token


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(title="AI Software Archaeologist AI Service", version="0.1.0")

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {
            "service": resolved_settings.service_name,
            "status": "ok",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @app.get("/internal/healthz")
    async def internal_healthz(token: str = Depends(require_internal_job_token)) -> dict[str, str]:
        verified = verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return {
            "jobId": verified.job_id,
            "service": resolved_settings.service_name,
            "status": "ok",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @app.post("/internal/analysis/static")
    async def internal_static_analysis(
        body: Annotated[StaticAnalysisRequest, Body()],
        token: str = Depends(require_internal_job_token),
    ) -> StaticAnalysisResponse:
        verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return analyze_snapshot(resolved_settings.workspace_root, body)

    @app.post("/internal/analysis/enrich")
    async def internal_enrichment(
        body: Annotated[EnrichmentRequest, Body()],
        token: str = Depends(require_internal_job_token),
    ) -> EnrichmentResponse:
        verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return await enrich_snapshot(resolved_settings, body)

    @app.post("/internal/embeddings")
    async def internal_embeddings(
        body: EmbeddingRequest,
        token: str = Depends(require_internal_job_token),
    ) -> EmbeddingResponse:
        verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return EmbeddingResponse(embeddings=await embed_text_batch(resolved_settings, body.texts))

    @app.post("/internal/chat/complete")
    async def internal_chat_complete(
        body: ChatCompletionRequest,
        token: str = Depends(require_internal_job_token),
    ) -> ChatCompletionResponse:
        verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return await complete_chat(resolved_settings, body)

    @app.post("/internal/analysis/deep")
    async def internal_deep_analysis(
        body: DeepAnalysisRequest,
        token: str = Depends(require_internal_job_token),
    ) -> DeepAnalysisResponse:
        verify_internal_job_token(
            token,
            resolved_settings.internal_job_token_secret.get_secret_value(),
        )
        return await complete_deep_analysis(resolved_settings, body)

    return app


app = create_app()
