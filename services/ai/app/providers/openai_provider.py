from __future__ import annotations

from openai import AsyncOpenAI

from app.providers.base import CompletionProvider, CompletionRequest, CompletionResponse


class OpenAICompletionProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        self._client = AsyncOpenAI(api_key=api_key)
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
        choice = response.choices[0].message.content or ""
        usage = response.usage
        return CompletionResponse(
            content=choice,
            model=response.model,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
        )


async def embed_texts(api_key: str, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    client = AsyncOpenAI(api_key=api_key)
    response = await client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in response.data]
