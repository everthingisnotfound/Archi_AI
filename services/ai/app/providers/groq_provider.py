from __future__ import annotations

import re

from openai import AsyncOpenAI

from app.providers.base import CompletionRequest, CompletionResponse

_THINKING_TAG_PATTERN = re.compile(r"<think>.*?</think>\s*", re.DOTALL)


def _sanitize_content(content: str) -> str:
    return _THINKING_TAG_PATTERN.sub("", content).strip()


class GroqCompletionProvider:
    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b") -> None:
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        self._model = model

    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": request.system},
                {"role": "user", "content": request.prompt},
            ],
            temperature=request.temperature,
        )
        choice = _sanitize_content(response.choices[0].message.content or "")
        usage = response.usage
        return CompletionResponse(
            content=choice,
            model=response.model,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
        )
