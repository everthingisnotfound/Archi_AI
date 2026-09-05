from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CompletionRequest:
    prompt: str
    system: str
    temperature: float = 0.1


@dataclass(frozen=True)
class CompletionResponse:
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int


class CompletionProvider(Protocol):
    async def complete(self, request: CompletionRequest) -> CompletionResponse:
        """Generate a grounded completion from an already assembled prompt."""

