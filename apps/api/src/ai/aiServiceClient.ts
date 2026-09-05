import { randomUUID } from "node:crypto";
import { signInternalJobToken } from "@ai-archaeologist/shared";
import type { ApiConfig } from "../config.js";

type ChatContextChunk = {
  endLine: number;
  path: string;
  startLine: number;
  text: string;
};

type ChatCompletionResult = {
  answer: string;
  completionTokens: number;
  model: string;
  promptTokens: number;
};

function buildOfflineChatAnswer(input: {
  contextChunks: ChatContextChunk[];
  question: string;
  repositoryName: string;
}): ChatCompletionResult {
  const uniquePaths = [...new Set(input.contextChunks.map((chunk) => chunk.path))];
  const previewPaths = uniquePaths.slice(0, 6).join(", ");
  const pathSummary =
    previewPaths.length > 0
      ? `Indexed files include: ${previewPaths}${uniquePaths.length > 6 ? ", …" : ""}.`
      : "No code chunks were indexed for retrieval yet.";

  return {
    answer: [
      `I could not reach the AI service to answer "${input.question}".`,
      "",
      `Repository: **${input.repositoryName}**`,
      pathSummary,
      "",
      "Static analysis results are still available in the dashboard. For full chat answers, ensure the AI service is running and configure `GROQ_API_KEY` or `OPENAI_API_KEY`.",
    ].join("\n"),
    completionTokens: 0,
    model: "offline",
    promptTokens: 0,
  };
}

export async function embedTexts(config: ApiConfig, texts: string[]): Promise<number[][]> {
  try {
    const token = signInternalJobToken(`embed-${randomUUID()}`, config.INTERNAL_JOB_TOKEN_SECRET);
    const response = await fetch(`${config.AI_SERVICE_URL}/internal/embeddings`, {
      body: JSON.stringify({ texts }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { embeddings: number[][] };
    return payload.embeddings;
  } catch {
    return [];
  }
}

export async function completeChat(
  config: ApiConfig,
  input: {
    contextChunks: ChatContextChunk[];
    question: string;
    repositoryName: string;
  },
): Promise<ChatCompletionResult> {
  try {
    const token = signInternalJobToken(`chat-${randomUUID()}`, config.INTERNAL_JOB_TOKEN_SECRET);
    const response = await fetch(`${config.AI_SERVICE_URL}/internal/chat/complete`, {
      body: JSON.stringify({
        contextChunks: input.contextChunks.map((chunk) => ({
          end_line: chunk.endLine,
          path: chunk.path,
          start_line: chunk.startLine,
          text: chunk.text,
        })),
        question: input.question,
        repositoryName: input.repositoryName,
      }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      return buildOfflineChatAnswer(input);
    }

    const payload = (await response.json()) as {
      answer: string;
      completion_tokens: number;
      model: string;
      prompt_tokens: number;
    };

    return {
      answer: payload.answer,
      completionTokens: payload.completion_tokens,
      model: payload.model,
      promptTokens: payload.prompt_tokens,
    };
  } catch {
    return buildOfflineChatAnswer(input);
  }
}
