import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, MessageSquare, SendHorizontal } from "lucide-react";
import { Button, Input } from "@ai-archaeologist/ui";
import { createChatSession, sendChatMessage } from "../api/repositories.js";

type ChatMessage = {
  content: string;
  id: string;
  role: "assistant" | "user";
};

type RepositoryChatPanelProps = {
  enabled: boolean;
  repositoryId: string;
};

export function RepositoryChatPanel({
  enabled,
  repositoryId,
}: RepositoryChatPanelProps): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const session =
        sessionId !== null
          ? { session: { id: sessionId }, snapshotId: "" }
          : await createChatSession(repositoryId, { title: "Repository chat" });

      if (sessionId === null) {
        setSessionId(session.session.id);
      }

      return sendChatMessage(repositoryId, session.session.id, content);
    },
    onSuccess: (result) => {
      setMessages((current) => [
        ...current,
        {
          content: result.userMessage.content,
          id: result.userMessage.id,
          role: "user",
        },
        {
          content: result.assistantMessage.content,
          id: result.assistantMessage.id,
          role: "assistant",
        },
      ]);
      setDraft("");
    },
  });

  return (
    <section className="overflow-hidden rounded-md border border-slate-800 bg-panel">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-sm font-medium text-white">
        <MessageSquare aria-hidden="true" className="text-cyan-300" size={17} />
        Ask this repository
      </div>
      <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            {enabled
              ? "Ask about architecture, modules, dependencies, or security findings."
              : "Chat unlocks after enrichment completes."}
          </p>
        ) : null}
        {messages.map((message) => (
          <div
            className={
              message.role === "user"
                ? "ml-8 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-50"
                : "mr-8 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            }
            key={message.id}
          >
            {message.content}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-slate-800 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() || !enabled || sendMutation.isPending) {
            return;
          }
          sendMutation.mutate(draft.trim());
        }}
      >
        <Input
          disabled={!enabled || sendMutation.isPending}
          onChange={(event) => { setDraft(event.target.value); }}
          placeholder="What does this repository do?"
          value={draft}
        />
        <Button
          aria-label="Send chat message"
          disabled={!enabled || !draft.trim() || sendMutation.isPending}
          size="icon"
          type="submit"
        >
          {sendMutation.isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
          ) : (
            <SendHorizontal aria-hidden="true" size={18} />
          )}
        </Button>
      </form>
      {sendMutation.error instanceof Error ? (
        <p className="border-t border-rose-400/20 px-4 py-2 text-sm text-rose-100">
          {sendMutation.error.message}
        </p>
      ) : null}
    </section>
  );
}
