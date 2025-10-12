"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { ChatDock } from "@/features/chat/components/chat-dock";
import { InlineDiffViewer, type InlineDiffViewerRef } from "@/components/inline-diff-viewer";
import { TagLibrary } from "@/components/tag-library";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";

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
const SECTION_HEADING_REGEX = /^[A-Z][A-Za-z0-9 '&()-]+:?$/;
const SECTION_HEADING_WITH_BODY_REGEX =
  /^([A-Z][A-Za-z0-9 '&()-]*(?:\s+\d+)?)\s*:\s+/;

type SectionBlock = {
  heading: string | null;
  paragraphs: string[];
};

function parseSections(html: string): SectionBlock[] {
  if (typeof document === "undefined") {
    return [{ heading: null, paragraphs: [html] }];
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraphs = Array.from(container.querySelectorAll("p"));

  const sections: SectionBlock[] = [];
  let current: SectionBlock | null = null;

  paragraphs.forEach((paragraph) => {
    const text = (paragraph.textContent ?? "").trim();
    const markup = `<p>${paragraph.innerHTML}</p>`;

    const isStandaloneHeading =
      SECTION_HEADING_REGEX.test(text) && text.split(" ").length <= 8;
    const headingMatch = text.match(SECTION_HEADING_WITH_BODY_REGEX);

    if (isStandaloneHeading) {
      if (current) {
        sections.push(current);
      }
      current = {
        heading: text.replace(/:$/, "").trim(),
        paragraphs: [markup],
      };
      return;
    }

    if (headingMatch) {
      if (current) {
        sections.push(current);
      }
      current = { heading: headingMatch[1].trim(), paragraphs: [markup] };
      return;
    }

    if (!current) {
      current = { heading: null, paragraphs: [] };
    }

    current.paragraphs.push(markup);
  });

  if (current) {
    sections.push(current);
  }

  return sections;
}

function mergeLyricsIntoDocument(currentHtml: string, optionHtml: string): string {
  if (typeof document === "undefined") {
    return optionHtml;
  }

  const normalizeParagraphs = (paragraphs: string[]) =>
    paragraphs.join("").replace(/\s+/g, " ").trim();

  const originalSections = parseSections(currentHtml);
  const originalByHeading = new Map<string, SectionBlock>();
  originalSections.forEach((section) => {
    if (section.heading) {
      originalByHeading.set(section.heading.toLowerCase(), section);
    }
  });

  const optionSections = parseSections(optionHtml);
  const replacements = new Map<string, SectionBlock>();

  optionSections.forEach((section) => {
    if (section.heading) {
      const key = section.heading.toLowerCase();
      const original = originalByHeading.get(key);
      if (!original) {
        replacements.set(key, section);
        return;
      }

      if (
        normalizeParagraphs(original.paragraphs) !==
        normalizeParagraphs(section.paragraphs)
      ) {
        replacements.set(key, section);
      }
    }
  });

  if (replacements.size === 0) {
    return currentHtml;
  }

  const used = new Set<string>();

  const mergedSections = originalSections.map((section) => {
    if (section.heading) {
      const key = section.heading.toLowerCase();
      if (replacements.has(key)) {
        used.add(key);
        const replacement = replacements.get(key)!;
        return {
          heading: replacement.heading,
          paragraphs: replacement.paragraphs,
        };
      }
    }
    return section;
  });

  replacements.forEach((section, key) => {
    if (!used.has(key)) {
      mergedSections.push(section);
    }
  });

  return mergedSections.flatMap((section) => section.paragraphs).join("");
}

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
}) {
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [pendingRestoreVersionId, setPendingRestoreVersionId] =
    useState<string | null>(null);

  const [isPreviewMode, setPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isChatCollapsed, setChatCollapsed] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [totalChangeCount, setTotalChangeCount] = useState(0);
  const diffViewerRef = useRef<InlineDiffViewerRef>(null);

  // Tag library state
  const [isTagLibraryOpen, setTagLibraryOpen] = useState(true);

  // Monitor when preview mode changes
  useEffect(() => {
    console.log("🔔 [LyricCanvas] isPreviewMode changed to:", isPreviewMode);
  }, [isPreviewMode]);

  useEffect(() => {
    console.log("🔔 [LyricCanvas] isChatCollapsed changed to:", isChatCollapsed);
  }, [isChatCollapsed]);

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
          editor.commands.setContent("", { emitUpdate: false });
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
        editor.commands.setContent(payload.content ?? "", { emitUpdate: false });
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

      editor?.commands.setContent("", { emitUpdate: false });
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

      editor.commands.setContent(version.content ?? "", { emitUpdate: false });
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

      editor.commands.setContent(version.content ?? "", { emitUpdate: false });
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

  const handlePreviewOption = useCallback(
    (optionHtml: string) => {
      console.log("🟢 [LyricCanvas] handlePreviewOption called");
      console.log("🟢 [LyricCanvas] editor exists:", !!editor);
      console.log("🟢 [LyricCanvas] optionHtml (raw):", optionHtml);

      if (!editor) {
        console.log("🔴 [LyricCanvas] No editor - returning early");
        return;
      }

      // Decode HTML entities if double-encoded (backend issue)
      let decodedHtml = optionHtml;
      if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = optionHtml;
        decodedHtml = textarea.value;
        console.log("🟢 [LyricCanvas] optionHtml (decoded):", decodedHtml);
      }

      const currentHtml = editor.getHTML();
      console.log("🟢 [LyricCanvas] currentHtml from editor:", currentHtml);

      const merged = mergeLyricsIntoDocument(currentHtml, decodedHtml);
      console.log("🟢 [LyricCanvas] merged result:", merged);

      setOriginalContent(currentHtml);
      setPreviewContent(merged ?? decodedHtml ?? "");
      setPreviewMode(true);
      setChatCollapsed(true);
      setApprovedCount(0);
      setTotalChangeCount(0);
      setMessage("Preview active. Review changes line-by-line.");

      console.log("🟢 [LyricCanvas] State updates triggered:");
      console.log("  - originalContent set to:", currentHtml.substring(0, 100) + "...");
      console.log("  - previewContent set to:", (merged ?? decodedHtml ?? "").substring(0, 100) + "...");
      console.log("  - isPreviewMode set to: true");
      console.log("  - isChatCollapsed set to: true");
    },
    [editor],
  );

  const handleAcceptPreview = useCallback(() => {
    if (!editor) {
      return;
    }

    // Get approved content from diff viewer
    const approvedContent = diffViewerRef.current?.getApprovedContent();

    if (approvedContent) {
      console.log("🟢 [LyricCanvas] Applying approved content:", approvedContent);
      editor.commands.setContent(approvedContent, { emitUpdate: false });
      setDirty(true);
      setState("idle");
      setMessage("Approved changes applied. Save to capture this revision.");
    } else {
      console.log("🔴 [LyricCanvas] No approved content available");
    }

    setPreviewMode(false);
    setPreviewContent(null);
    setOriginalContent(null);
    setChatCollapsed(false);
  }, [editor]);

  const handleCancelPreview = useCallback(() => {
    console.log("❌ [LyricCanvas] handleCancelPreview called - RESETTING STATE");
    setPreviewMode(false);
    setPreviewContent(null);
    setOriginalContent(null);
    setChatCollapsed(false);
    setMessage(null);
  }, []);

  const getDocumentContent = useCallback(() => editor?.getHTML() ?? "", [editor]);

  const getDocumentVersionId = useCallback(
    () => currentVersionId,
    [currentVersionId],
  );

  // Drag and drop handlers for tag library (after editor is initialized)
  const { handleDragStart, handleDragEnd, handleDrop, handleDragOver } = useDragAndDrop({ editor });

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

  console.log("🟡 [LyricCanvas] Render - State Check:");
  console.log("  - isPreviewMode:", isPreviewMode);
  console.log("  - originalContent exists:", !!originalContent);
  console.log("  - previewContent exists:", !!previewContent);
  console.log("  - isChatCollapsed:", isChatCollapsed);
  console.log("  - editor exists:", !!editor);

  return (
    <section className={`canvas-layout${!isTagLibraryOpen ? " canvas-layout-sidebar-collapsed" : ""}`}>
      <aside className={`canvas-sidebar${!isTagLibraryOpen ? " canvas-sidebar-collapsed" : ""}`}>
        <div className="canvas-sidebar-section tags-section">
          <TagLibrary
            isOpen={isTagLibraryOpen}
            onToggle={() => setTagLibraryOpen(!isTagLibraryOpen)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </div>
        <div
          className={`canvas-sidebar-section chat-section${
            isChatCollapsed ? " chat-section-collapsed" : ""
          }`}
        >
          <ChatDock
            documentId={documentId}
            getDocumentContent={getDocumentContent}
            getDocumentVersionId={getDocumentVersionId}
            onPreviewOption={handlePreviewOption}
            isCollapsed={isChatCollapsed}
            onExpandCollapse={() => setChatCollapsed((previous) => !previous)}
          />
        </div>
      </aside>
      <aside className="history-panel" style={{ display: 'none' }}>
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
          {isPreviewMode ? (
            <>
              <button
                type="button"
                className="preview-accept-button"
                onClick={handleAcceptPreview}
              >
                {approvedCount === 0
                  ? "Accept All"
                  : approvedCount === totalChangeCount
                    ? "Accept"
                    : `Accept Remaining (${totalChangeCount - approvedCount})`}
              </button>
              <button
                type="button"
                className="preview-cancel-button"
                onClick={handleCancelPreview}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="save-button"
              onClick={handleSave}
              disabled={!canSave}
            >
              {saveLabel}
            </button>
          )}
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
        <div
          className="editor-frame"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {(() => {
            if (isPreviewMode && originalContent && previewContent) {
              console.log("🟣 [LyricCanvas] Rendering InlineDiffViewer");
              return (
                <InlineDiffViewer
                  ref={diffViewerRef}
                  originalHtml={originalContent}
                  previewHtml={previewContent}
                  onApprovalChange={(approved, total) => {
                    setApprovedCount(approved);
                    setTotalChangeCount(total);
                  }}
                />
              );
            } else if (editor) {
              console.log("🟣 [LyricCanvas] Rendering EditorContent");
              return <EditorContent editor={editor} />;
            } else {
              console.log("🟣 [LyricCanvas] Rendering placeholder");
              return <div className="editor-placeholder">Preparing editor…</div>;
            }
          })()}
        </div>
      </div>
    </section>
  );
}
