from functools import lru_cache
from typing import Literal

from pydantic import AnyUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ai_provider: Literal["openai", "groq"] = "openai"
    database_url: str = Field(min_length=1)
    groq_api_key: SecretStr | None = None
    groq_model: str = "openai/gpt-oss-120b"
    internal_job_token_secret: SecretStr = Field(min_length=32)
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    redis_url: AnyUrl = "redis://localhost:6379"
    service_name: str = "ai-service"
    workspace_root: str = Field(default="./data/workspaces", min_length=1)


@lru_cache
def get_settings() -> Settings:
    return Settings()

