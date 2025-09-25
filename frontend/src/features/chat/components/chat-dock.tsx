"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";

import { useChatSession } from "@/features/chat/hooks/useChatSession";
import type { ChatMessage, DiffChunk } from "@/features/chat/types";

export type ChatDockProps = {
  documentId: string;
  getDocumentContent: () => string;
  getDocumentVersionId: () => string | null;
  getSelection?: () => string | null;
  metadata?: Record<string, string> | null;
  onApplySuggestion?: (content: string) => void;
};

export function ChatDock({
  documentId,
  getDocumentContent,
  getDocumentVersionId,
  getSelection,
  metadata,
  onApplySuggestion,
}: ChatDockProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, isSending, error, sendMessage } = useChatSession({
    documentId,
    getDocumentContent,
    getDocumentVersionId,
    getSelection,
    metadata,
  });

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = draft.trim();
      if (!trimmed || isSending) {
        return;
      }
      setDraft("");
      await sendMessage(trimmed);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => composerRef.current?.focus());
      }
    },
    [draft, isSending, sendMessage],
  );

  const reversedMessages = useMemo(() => messages.slice().reverse(), [messages]);

  return (
    <aside className="chat-panel" aria-label="Chat with assistant">
      <header className="chat-header">
        <h2>GPT Collaborator</h2>
        <p>Describe what you need and we will diff the suggestion against your canvas.</p>
      </header>
      <div className="chat-thread" role="log" aria-live="polite">
        {reversedMessages.length === 0 ? (
          <p className="chat-empty">
            Ask for a revision, explain a section, or request alternatives. We will echo back
            suggestions with GitHub-style highlights.
          </p>
        ) : (
          reversedMessages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onApplySuggestion={onApplySuggestion}
            />
          ))
        )}
      </div>
      <footer className="chat-composer">
        <form onSubmit={handleSubmit}>
          <label htmlFor="chat-input" className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id="chat-input"
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask for punchier imagery, variations, or structure tweaks..."
            rows={3}
            className="chat-textarea"
            disabled={isSending}
          />
          <div className="chat-actions">
            <button
              type="submit"
              className="chat-send-button"
              disabled={isSending || draft.trim().length === 0}
            >
              {isSending ? "Sending…" : "Send"}
            </button>
            {error ? <p className="chat-error">{error}</p> : null}
          </div>
        </form>
      </footer>
    </aside>
  );
}

function ChatBubble({
  message,
  onApplySuggestion,
}: {
  message: ChatMessage;
  onApplySuggestion?: (content: string) => void;
}): JSX.Element {
  const isAssistant = message.role === "assistant";

  const handleApply = useCallback(() => {
    if (message.suggestedContent && onApplySuggestion) {
      onApplySuggestion(message.suggestedContent);
    }
  }, [message.suggestedContent, onApplySuggestion]);

  return (
    <article
      className={`chat-bubble chat-bubble-${message.role}${
        message.status === "error" ? " chat-bubble-error" : ""
      }`}
    >
      <header className="chat-bubble-head">
        <span className="chat-bubble-role">
          {isAssistant ? "Assistant" : message.role === "user" ? "You" : "System"}
        </span>
        <time className="chat-bubble-time">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </header>
      {message.status === "error" ? (
        <p className="chat-bubble-error-text">{message.error}</p>
      ) : null}
      {message.content ? <p className="chat-bubble-content">{message.content}</p> : null}
      {isAssistant && message.diff && message.diff.length > 0 ? (
        <DiffPreview diff={message.diff} />
      ) : null}
      {isAssistant && message.suggestedContent && onApplySuggestion ? (
        <button type="button" className="chat-apply-button" onClick={handleApply}>
          Apply to Canvas
        </button>
      ) : null}
    </article>
  );
}

function DiffPreview({ diff }: { diff: DiffChunk[] }): JSX.Element {
  return (
    <pre className="chat-diff" aria-label="Diff preview">
      {diff.map((chunk, index) => (
        <span key={`${chunk.type}-${index}`} className={`diff-chunk diff-${chunk.type}`}>
          {chunk.text}
        </span>
      ))}
    </pre>
  );
}
