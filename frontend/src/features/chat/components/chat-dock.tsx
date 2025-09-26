"use client";

import { FormEvent, useCallback, useMemo, useRef, useState } from "react";

import { useChatSession } from "@/features/chat/hooks/useChatSession";
import type { ChatMessage, DiffChunk, LyricOption } from "@/features/chat/types";

export type ChatDockProps = {
  documentId: string;
  getDocumentContent: () => string;
  getDocumentVersionId: () => string | null;
  getSelection?: () => string | null;
  metadata?: Record<string, string> | null;
  onPreviewOption?: (content: string) => void;
};

export function ChatDock({
  documentId,
  getDocumentContent,
  getDocumentVersionId,
  getSelection,
  metadata,
  onPreviewOption,
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
        <p>Describe what you need; we return commentary plus a diff of the revised lyrics.</p>
      </header>
      <div className="chat-thread" role="log" aria-live="polite">
        {reversedMessages.length === 0 ? (
          <p className="chat-empty">
            Ask for a revision, explain a section, or request alternatives. Each reply includes
            commentary bullets and a GitHub-style diff so you can sanity-check before applying.
          </p>
        ) : (
          reversedMessages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onPreviewOption={onPreviewOption}
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
  onPreviewOption,
}: {
  message: ChatMessage;
  onPreviewOption?: (content: string) => void;
}): JSX.Element {
  const isAssistant = message.role === "assistant";

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
      {isAssistant && message.status !== "error" ? (
        <CommentaryList message={message} />
      ) : message.content ? (
        <p className="chat-bubble-content">{message.content}</p>
      ) : null}
      {isAssistant && message.options && message.options.length > 0 ? (
        <OptionsList options={message.options} onPreviewOption={onPreviewOption} />
      ) : null}
    </article>
  );
}

function CommentaryList({ message }: { message: ChatMessage }): JSX.Element | null {
  const items = message.commentary?.length
    ? message.commentary
    : message.content
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <ul className="chat-commentary">
      {items.map((entry, index) => (
        <li key={`${message.id}-commentary-${index}`}>{entry}</li>
      ))}
    </ul>
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

function OptionsList({
  options,
  onPreviewOption,
}: {
  options: LyricOption[];
  onPreviewOption?: (lyrics: string) => void;
}): JSX.Element {
  return (
    <div className="chat-options">
      {options.map((option, index) => (
        <div key={`option-${index}`} className="chat-option">
          <div className="chat-option-head">
            <span className="chat-option-label">{option.label}</span>
            {onPreviewOption ? (
              <button
                type="button"
                className="chat-apply-button"
                onClick={() => onPreviewOption(option.lyrics)}
                disabled={!option.lyrics}
              >
                Preview in Canvas
              </button>
            ) : null}
          </div>
          {option.diff && option.diff.length > 0 ? <DiffPreview diff={option.diff} /> : null}
        </div>
      ))}
    </div>
  );
}
