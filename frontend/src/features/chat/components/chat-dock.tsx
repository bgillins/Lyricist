"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChatSession } from "@/features/chat/hooks/useChatSession";
import type {
  SelectionPayload,
  SendMessageOptions,
} from "@/features/chat/hooks/useChatSession";
import type { ChatMessage, DiffChunk, LyricOption } from "@/features/chat/types";

export type ChatDockProps = {
  documentId: string;
  getDocumentContent: () => string;
  getDocumentVersionId: () => string | null;
  prepareSelectionRequest?: () => SelectionRequest | null;
  incomingSelectionRequest?: SelectionRequest | null;
  onSelectionRequestConsumed?: () => void;
  onSelectionRequestSubmitted?: () => void;
  onSelectionResponseReady?: () => void;
  metadata?: Record<string, string> | null;
  onPreviewOption?: (option: LyricOption) => void;
  isCollapsed?: boolean;
  onExpandCollapse?: () => void;
};

export type SelectionRequest = {
  prompt: string;
  selection: SelectionPayload;
};

export function ChatDock({
  documentId,
  getDocumentContent,
  getDocumentVersionId,
  prepareSelectionRequest,
  incomingSelectionRequest,
  onSelectionRequestConsumed,
  onSelectionRequestSubmitted,
  onSelectionResponseReady,
  metadata,
  onPreviewOption,
  isCollapsed = false,
  onExpandCollapse,
}: ChatDockProps) {
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [pendingSelection, setPendingSelection] = useState<SelectionRequest | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const lastSelectionResponseId = useRef<string | null>(null);

  const { messages, isSending, error, sendMessage } = useChatSession({
    documentId,
    getDocumentContent,
    getDocumentVersionId,
    metadata,
  });

  useEffect(() => {
    if (!incomingSelectionRequest) {
      return;
    }

    setDraft(incomingSelectionRequest.prompt);
    setPendingSelection(incomingSelectionRequest);
    lastSelectionResponseId.current = null;
    setHelperMessage(null);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }

    onSelectionRequestConsumed?.();
  }, [incomingSelectionRequest, onSelectionRequestConsumed]);

  const handleSelectionIntent = useCallback(() => {
    if (!prepareSelectionRequest) {
      setHelperMessage("Selection actions are unavailable right now.");
      return;
    }

    const request = prepareSelectionRequest();
    if (!request) {
      setHelperMessage("Highlight lyrics in the canvas before asking about a selection.");
      return;
    }

    setDraft(request.prompt);
    setPendingSelection(request);
    lastSelectionResponseId.current = null;
    setHelperMessage(null);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  }, [prepareSelectionRequest]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = draft.trim();
      if (!trimmed || isSending) {
        return;
      }
      setDraft("");
      const options: SendMessageOptions = pendingSelection
        ? {
            scope: "selection",
            selection: pendingSelection.selection,
          }
        : { scope: "document" };

      const success = await sendMessage(trimmed, options);

      if (pendingSelection) {
        if (success) {
          onSelectionRequestSubmitted?.();
          setPendingSelection(null);
          setHelperMessage(null);
        } else {
          setHelperMessage("Unable to reach the assistant. Try again in a moment.");
        }
        lastSelectionResponseId.current = null;
      } else {
        setHelperMessage(null);
      }

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => composerRef.current?.focus());
      }
    },
    [draft, isSending, onSelectionRequestSubmitted, pendingSelection, sendMessage],
  );

  const reversedMessages = useMemo(() => messages.slice().reverse(), [messages]);

  useEffect(() => {
    if (!onSelectionResponseReady) {
      return;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message.role === "assistant" &&
        message.scope === "selection" &&
        message.status === "complete"
      ) {
        if (lastSelectionResponseId.current !== message.id) {
          lastSelectionResponseId.current = message.id;
          onSelectionResponseReady();
        }
        break;
      }
    }
  }, [messages, onSelectionResponseReady]);

  if (isCollapsed) {
    return (
      <aside className="chat-panel chat-panel-collapsed" aria-label="Chat with assistant">
        <button
          type="button"
          className="chat-expand-button"
          onClick={onExpandCollapse}
          aria-label="Expand chat"
        >
          <span className="chat-expand-icon">💬</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="chat-panel" aria-label="Chat with assistant">
      <header className="chat-header">
        <h2>GPT Collaborator</h2>
        <p>Describe what you need; we return commentary plus a diff of the revised lyrics.</p>
        <div className="chat-toolbar">
          <button
            type="button"
            className="chat-highlight-button"
            onClick={handleSelectionIntent}
            disabled={isSending}
          >
            Highlight → Assistant
          </button>
        </div>
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
          {pendingSelection ? (
            <p className="chat-selection-indicator">Next reply will focus on the highlighted lyrics.</p>
          ) : null}
          <div className="chat-actions">
            <button
              type="submit"
              className="chat-send-button"
              disabled={isSending || draft.trim().length === 0}
            >
              {isSending ? "Sending…" : "Send"}
            </button>
            {helperMessage ? <p className="chat-hint">{helperMessage}</p> : null}
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
  onPreviewOption?: (option: LyricOption) => void;
}) {
  const isAssistant = message.role === "assistant";
  const scopeLabel: string | null =
    message.scope === "selection"
      ? "Selection"
      : message.scope === "document"
        ? null
        : null;

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
        {scopeLabel ? <span className="chat-bubble-scope">{scopeLabel}</span> : null}
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

function CommentaryList({ message }: { message: ChatMessage }) {
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

function DiffPreview({ diff }: { diff: DiffChunk[] }) {
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
  onPreviewOption?: (option: LyricOption) => void;
}) {
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
                onClick={() => {
                  onPreviewOption(option);
                }}
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
