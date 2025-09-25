"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type DocumentResponse = {
  id: string;
  content: string;
  updated_at: string;
  version_id: string;
};

type DocumentVersion = {
  id: string;
  document_id: string;
  content: string;
  created_at: string;
};

type SaveState = "loading" | "idle" | "saving" | "saved" | "error";
type HistoryState = "idle" | "loading" | "error";

const HISTORY_SNIPPET_LENGTH = 120;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSnippet(html: string): string {
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) {
    return "(empty)";
  }

  if (plain.length <= HISTORY_SNIPPET_LENGTH) {
    return plain;
  }

  return `${plain.slice(0, HISTORY_SNIPPET_LENGTH)}…`;
}

export function LyricCanvas({
  documentId,
}: {
  documentId: string;
}): JSX.Element {
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [pendingRestoreVersionId, setPendingRestoreVersionId] =
    useState<string | null>(null);

  const [historyState, setHistoryState] = useState<HistoryState>("idle");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);

  const editor = useEditor({
    extensions: [StarterKit],
    editorProps: {
      attributes: {
        class: "editor-content",
        spellcheck: "true",
      },
    },
    content: "",
    onUpdate: () => {
      setDirty(true);
      setState((current) => (current === "saved" ? "idle" : current));
    },
    immediatelyRender: false,
  });

  const loadHistory = useCallback(
    async (options?: { signal?: AbortSignal }) => {
      setHistoryState("loading");
      setHistoryError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/versions`,
          { signal: options?.signal },
        );

        if (response.status === 404) {
          setVersions([]);
          setHistoryState("idle");
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load history (${response.status})`);
        }

        const payload = (await response.json()) as DocumentVersion[];
        setVersions(payload);
        setHistoryState("idle");
      } catch (error) {
        if (
          (options?.signal?.aborted ?? false) ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        console.error(error);
        setHistoryState("error");
        setHistoryError(
          error instanceof Error ? error.message : "Unable to load history",
        );
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const controller = new AbortController();

    const fetchDocument = async () => {
      setState("loading");
      setMessage(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`,
          { signal: controller.signal },
        );

        if (response.status === 404) {
          editor.commands.setContent("", false);
          setDirty(false);
          setCurrentVersionId(null);
          setPreviewVersionId(null);
          setPendingRestoreVersionId(null);
          setState("idle");
          await loadHistory({ signal: controller.signal });
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`);
        }

        const payload = (await response.json()) as DocumentResponse;
        editor.commands.setContent(payload.content ?? "", false);
        setDirty(false);
        setState("idle");
        setCurrentVersionId(payload.version_id);
        setPreviewVersionId(null);
        setPendingRestoreVersionId(null);
        setMessage(
          `Last saved ${new Date(payload.updated_at).toLocaleTimeString()}`,
        );
        await loadHistory({ signal: controller.signal });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error(error);
        setState("error");
        setMessage(
          error instanceof Error ? error.message : "Unable to load document",
        );
      }
    };

    fetchDocument();

    return () => {
      controller.abort();
    };
  }, [documentId, editor, loadHistory]);

  const handleSave = useCallback(async () => {
    if (!editor) {
      return;
    }

    setState("saving");
    setMessage(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: editor.getHTML() }),
        },
      );

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      const payload = (await response.json()) as DocumentResponse;
      setDirty(false);
      setState("saved");
      setCurrentVersionId(payload.version_id);
      setPreviewVersionId(null);
      setPendingRestoreVersionId(null);
      setMessage(
        `Saved ${new Date(payload.updated_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      );

      await loadHistory();

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          setState("idle");
        }, 1500);
      }
    } catch (error) {
      console.error(error);
      setState("error");
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }, [documentId, editor, loadHistory]);

  const handleClear = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const firstPrompt = window.confirm(
      "This will delete every saved lyric document. Continue?",
    );
    if (!firstPrompt) {
      return;
    }

    const secondPrompt = window.confirm(
      "This cannot be undone. Are you absolutely sure you want to delete all records?",
    );
    if (!secondPrompt) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/documents`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to clear documents (${response.status})`);
      }

      editor?.commands.setContent("", false);
      setDirty(false);
      setCurrentVersionId(null);
      setPreviewVersionId(null);
      setPendingRestoreVersionId(null);
      setVersions([]);
      setHistoryState("idle");
      setHistoryError(null);
      setState("idle");
      setMessage("All history cleared");
    } catch (error) {
      console.error(error);
      setHistoryState("error");
      setHistoryError(
        error instanceof Error ? error.message : "Unable to clear documents",
      );
    }
  }, [editor]);

  const handlePreview = useCallback(
    (version: DocumentVersion) => {
      if (!editor) {
        return;
      }

      editor.commands.setContent(version.content ?? "", false);
      setDirty(true);
      setState("idle");
      setPreviewVersionId(version.id);
      setPendingRestoreVersionId(null);
      setMessage(
        `Previewing revision from ${formatTimestamp(
          version.created_at,
        )}. Save to commit or choose Restore to stage it.`,
      );
    },
    [editor],
  );

  const handleRestore = useCallback(
    (version: DocumentVersion) => {
      if (!editor) {
        return;
      }

      editor.commands.setContent(version.content ?? "", false);
      setDirty(true);
      setState("idle");
      setPreviewVersionId(version.id);
      setPendingRestoreVersionId(version.id);
      setMessage(
        `Restore ready — press Save to promote the revision from ${formatTimestamp(
          version.created_at,
        )}.`,
      );
    },
    [editor],
  );

  const saveLabel = useMemo(() => {
    switch (state) {
      case "loading":
        return "Loading...";
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved";
      case "error":
        return "Retry";
      default:
        return "Save";
    }
  }, [state]);

  const canSave =
    Boolean(editor) && isDirty && state !== "saving" && state !== "loading";
  const showStatus =
    Boolean(message) || state === "loading" || state === "saving";

  return (
    <section className="canvas-layout">
      <aside className="history-panel">
        <div className="history-header">
          <h2>Revision History</h2>
          <button type="button" className="clear-button" onClick={handleClear}>
            Clear All
          </button>
        </div>
        {historyState === "error" ? (
          <p className="history-status history-status-error">
            {historyError ?? "Unable to load history"}
          </p>
        ) : versions.length === 0 ? (
          <p className="history-empty">
            {historyState === "loading"
              ? "Loading history…"
              : "No saved versions yet. Capture your first idea and hit save to see it appear here."}
          </p>
        ) : (
          <>
            <ul className="history-list">
              {versions.map((version) => {
                const isCurrent = version.id === currentVersionId;
                const isPreview = version.id === previewVersionId;
                const isPending = version.id === pendingRestoreVersionId;
                return (
                  <li
                    key={version.id}
                    className={`history-entry${
                      isCurrent ? " history-entry-current" : ""
                    }${
                      isPreview ? " history-entry-preview" : ""
                    }${
                      isPending ? " history-entry-pending" : ""
                    }`}
                    title={`Version ${version.id}`}
                  >
                    <button
                      type="button"
                      className="history-entry-button"
                      onClick={() => handlePreview(version)}
                    >
                      <span className="history-entry-time">
                        {formatTimestamp(version.created_at)}
                      </span>
                      <span className="history-entry-snippet">
                        {toSnippet(version.content)}
                      </span>
                    </button>
                    <div className="history-entry-actions">
                      <button
                        type="button"
                        className="history-restore-button"
                        onClick={() => handleRestore(version)}
                      >
                        {isPending ? "Selected" : "Restore"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {historyState === "loading" ? (
              <p className="history-status">Refreshing…</p>
            ) : null}
          </>
        )}
      </aside>
      <div className="canvas-card">
        <div className="canvas-toolbar">
          <button
            type="button"
            className="save-button"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saveLabel}
          </button>
          {showStatus ? (
            <span
              className={`status-pill status-${state}`}
              aria-live="polite"
              role="status"
            >
              {message ?? saveLabel}
            </span>
          ) : null}
        </div>
        <div className="editor-frame">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="editor-placeholder">Preparing editor…</div>
          )}
        </div>
      </div>
    </section>
  );
}
