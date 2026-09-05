from __future__ import annotations

from app.config import Settings


def is_completion_configured(settings: Settings) -> bool:
    if settings.ai_provider == "groq":
        return settings.groq_api_key is not None
    if settings.ai_provider == "openai":
        return settings.openai_api_key is not None
    return False


def is_embedding_configured(settings: Settings) -> bool:
    return settings.openai_api_key is not None
