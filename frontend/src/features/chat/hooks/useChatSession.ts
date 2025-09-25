"use client";

import { useCallback, useMemo, useState } from "react";

import type {
  ChatMessage,
  ChatRequestPayload,
  ChatResponsePayload,
  DiffChunk,
} from "@/features/chat/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type UseChatSessionOptions = {
  documentId: string;
  getDocumentContent: () => string;
  getDocumentVersionId: () => string | null;
  getSelection?: () => string | null;
  metadata?: Record<string, string> | null;
};

export type UseChatSessionReturn = {
  messages: ChatMessage[];
  isSending: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  reset: () => void;
};

let messageCounter = 0;

const nextMessageId = () => {
  messageCounter += 1;
  return `msg-${messageCounter}`;
};

export function useChatSession(options: UseChatSessionOptions): UseChatSessionReturn {
  const {
    documentId,
    getDocumentContent,
    getDocumentVersionId,
    metadata,
    getSelection,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
        status: "complete",
      };

      const pendingAssistant: ChatMessage = {
        id: nextMessageId(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        status: "pending",
      };

      setMessages((current) => [...current, userMessage, pendingAssistant]);
      setIsSending(true);
      setError(null);

      const payload: ChatRequestPayload = {
        message: trimmed,
        document_content: getDocumentContent(),
        selection: getSelection ? getSelection() : null,
        context: {
          document_id: documentId,
          document_version_id: getDocumentVersionId(),
          metadata: metadata ?? null,
        },
      };

      try {
        const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(documentId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Chat request failed (${response.status})`);
        }

        const data = (await response.json()) as ChatResponsePayload;

        setMessages((current) =>
          current.map((msg) =>
            msg.id === pendingAssistant.id
              ? {
                  ...msg,
                  content: data.message,
                  diff: normalizeDiff(data.diff),
                  suggestedContent: data.suggested_content,
                  status: "complete",
                  createdAt: Date.now(),
                }
              : msg,
          ),
        );
      } catch (err) {
        console.error(err);
        const errorMessage =
          err instanceof Error ? err.message : "Unable to contact the assistant";
        setError(errorMessage);
        setMessages((current) =>
          current.map((msg) =>
            msg.id === pendingAssistant.id
              ? { ...msg, status: "error", error: errorMessage, createdAt: Date.now() }
              : msg,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [documentId, getDocumentContent, getDocumentVersionId, metadata, getSelection],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return useMemo(
    () => ({ messages, isSending, error, sendMessage, reset }),
    [messages, isSending, error, sendMessage, reset],
  );
}

function normalizeDiff(chunks: DiffChunk[] | undefined): DiffChunk[] {
  if (!chunks || chunks.length === 0) {
    return [];
  }
  return chunks.map((chunk) => ({ ...chunk, text: chunk.text ?? "" }));
}
