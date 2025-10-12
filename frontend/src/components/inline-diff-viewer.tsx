"use client";

import { useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";

type DiffLine = {
  type: "equal" | "insert" | "delete";
  text: string;
};

type LineApprovalState = "pending" | "approved" | "rejected";

export type InlineDiffViewerProps = {
  originalHtml: string;
  previewHtml: string;
  onApprovalChange?: (approvedCount: number, totalChangeCount: number) => void;
};

export type InlineDiffViewerRef = {
  getApprovedContent: () => string;
};

function htmlToLines(html: string): string[] {
  if (typeof document === "undefined") {
    return [];
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraphs = Array.from(container.querySelectorAll("p"));

  return paragraphs.map((p) => p.textContent?.trim() || "");
}

function computeLineDiff(original: string[], preview: string[]): DiffLine[] {
  const diffs: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < original.length || j < preview.length) {
    if (i >= original.length) {
      // Only preview lines left - all insertions
      diffs.push({ type: "insert", text: preview[j] });
      j++;
    } else if (j >= preview.length) {
      // Only original lines left - all deletions
      diffs.push({ type: "delete", text: original[i] });
      i++;
    } else if (original[i] === preview[j]) {
      // Lines match - equal
      diffs.push({ type: "equal", text: original[i] });
      i++;
      j++;
    } else {
      // Lines differ - look ahead to see if this is a deletion or replacement
      const nextInPreview = preview.indexOf(original[i], j);
      const nextInOriginal = original.indexOf(preview[j], i);

      if (nextInPreview !== -1 && (nextInOriginal === -1 || nextInPreview < nextInOriginal)) {
        // Original line appears later in preview - treat current preview as insertion
        diffs.push({ type: "insert", text: preview[j] });
        j++;
      } else if (nextInOriginal !== -1) {
        // Preview line appears later in original - treat current original as deletion
        diffs.push({ type: "delete", text: original[i] });
        i++;
      } else {
        // No match found - treat as replacement (delete + insert)
        diffs.push({ type: "delete", text: original[i] });
        diffs.push({ type: "insert", text: preview[j] });
        i++;
        j++;
      }
    }
  }

  return diffs;
}

export const InlineDiffViewer = forwardRef<InlineDiffViewerRef, InlineDiffViewerProps>(
  function InlineDiffViewer({ originalHtml, previewHtml, onApprovalChange }, ref) {
  console.log("🟠 [InlineDiffViewer] Component rendering");
  console.log("🟠 [InlineDiffViewer] originalHtml:", originalHtml.substring(0, 100) + "...");
  console.log("🟠 [InlineDiffViewer] previewHtml:", previewHtml.substring(0, 100) + "...");

  const originalLines = useMemo(() => htmlToLines(originalHtml), [originalHtml]);
  const previewLines = useMemo(() => htmlToLines(previewHtml), [previewHtml]);

  console.log("🟠 [InlineDiffViewer] originalLines count:", originalLines.length);
  console.log("🟠 [InlineDiffViewer] previewLines count:", previewLines.length);
  console.log("🟠 [InlineDiffViewer] originalLines sample:", originalLines.slice(0, 3));
  console.log("🟠 [InlineDiffViewer] previewLines sample:", previewLines.slice(0, 3));

  const diffs = useMemo(() => computeLineDiff(originalLines, previewLines), [originalLines, previewLines]);

  console.log("🟠 [InlineDiffViewer] diffs computed:", diffs.length, "lines");
  console.log("🟠 [InlineDiffViewer] diffs sample:", diffs.slice(0, 5));

  // Initialize approval state for each line (only for insert lines)
  const [lineApprovals, setLineApprovals] = useState<Map<number, LineApprovalState>>(() => {
    const approvals = new Map<number, LineApprovalState>();
    diffs.forEach((diff, index) => {
      if (diff.type === "insert") {
        approvals.set(index, "pending");
      }
    });
    return approvals;
  });

  const handleApprove = useCallback((index: number) => {
    setLineApprovals((prev) => {
      const next = new Map(prev);
      next.set(index, "approved");
      return next;
    });
  }, []);

  const handleReject = useCallback((index: number) => {
    setLineApprovals((prev) => {
      const next = new Map(prev);
      next.set(index, "rejected");
      return next;
    });
  }, []);

  // Notify parent of approval changes (after render)
  useEffect(() => {
    const approvedCount = Array.from(lineApprovals.values()).filter(v => v === "approved").length;
    const totalChanges = diffs.filter(d => d.type === "insert").length;
    onApprovalChange?.(approvedCount, totalChanges);
  }, [lineApprovals, diffs, onApprovalChange]);

  // Expose method to get approved content
  useImperativeHandle(ref, () => ({
    getApprovedContent: () => {
      const approvedLines: string[] = [];

      diffs.forEach((diff, index) => {
        if (diff.type === "equal") {
          // Always include unchanged lines
          approvedLines.push(diff.text);
        } else if (diff.type === "insert") {
          const approval = lineApprovals.get(index);
          // Only include approved insert lines
          if (approval === "approved") {
            approvedLines.push(diff.text);
          }
        }
        // Skip delete lines and rejected/pending insert lines
      });

      // Convert back to HTML
      return approvedLines.map(line => `<p>${line}</p>`).join("");
    },
  }), [diffs, lineApprovals]);

  console.log("🟠 [InlineDiffViewer] About to render", diffs.length, "diff lines");

  return (
    <div className="inline-diff-viewer">
      {diffs.map((diff, index) => {
        const approval = lineApprovals.get(index);

        if (diff.type === "equal") {
          return (
            <p key={`diff-${index}`} className="diff-line diff-line-equal">
              {diff.text}
            </p>
          );
        }

        if (diff.type === "delete") {
          return (
            <p key={`diff-${index}`} className="diff-line diff-line-delete">
              {diff.text}
            </p>
          );
        }

        if (diff.type === "insert") {
          // Treat undefined approval as "pending"
          const isPending = !approval || approval === "pending";
          const isApproved = approval === "approved";
          const isRejected = approval === "rejected";

          return (
            <div key={`diff-${index}`} className="diff-line-container">
              <p className={`diff-line diff-line-insert${isApproved ? " diff-line-approved" : ""}${isRejected ? " diff-line-rejected" : ""}`}>
                {diff.text}
              </p>
              {isPending && (
                <div className="diff-line-actions">
                  <button
                    type="button"
                    className="diff-approve-button"
                    onClick={() => handleApprove(index)}
                    title="Accept insertion"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="diff-reject-button"
                    onClick={() => handleReject(index)}
                    title="Reject insertion"
                  >
                    ✗
                  </button>
                </div>
              )}
              {isApproved && <span className="diff-status-icon">✓</span>}
              {isRejected && <span className="diff-status-icon">✗</span>}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
});
