from app.config import Settings
from app.providers.base import CompletionProvider
from app.providers.groq_provider import GroqCompletionProvider
from app.providers.openai_provider import OpenAICompletionProvider


class ProviderConfigurationError(RuntimeError):
    pass


def create_completion_provider(settings: Settings) -> CompletionProvider:
    if settings.ai_provider == "openai":
        if settings.openai_api_key is None:
            raise ProviderConfigurationError("OPENAI_API_KEY is required when AI_PROVIDER=openai")
        return OpenAICompletionProvider(
            settings.openai_api_key.get_secret_value(),
            model=settings.openai_model,
        )

    if settings.ai_provider == "groq":
        if settings.groq_api_key is None:
            raise ProviderConfigurationError("GROQ_API_KEY is required when AI_PROVIDER=groq")
        return GroqCompletionProvider(
            settings.groq_api_key.get_secret_value(),
            model=settings.groq_model,
        )

    raise ProviderConfigurationError(f"Unsupported AI provider: {settings.ai_provider}")
