"use client";

type DiffLine = {
  type: "equal" | "insert" | "delete";
  text: string;
};

export type InlineDiffViewerProps = {
  originalHtml: string;
  previewHtml: string;
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

export function InlineDiffViewer({
  originalHtml,
  previewHtml,
}: InlineDiffViewerProps) {
  console.log("🟠 [InlineDiffViewer] Component rendering");
  console.log("🟠 [InlineDiffViewer] originalHtml:", originalHtml.substring(0, 100) + "...");
  console.log("🟠 [InlineDiffViewer] previewHtml:", previewHtml.substring(0, 100) + "...");

  const originalLines = htmlToLines(originalHtml);
  const previewLines = htmlToLines(previewHtml);

  console.log("🟠 [InlineDiffViewer] originalLines count:", originalLines.length);
  console.log("🟠 [InlineDiffViewer] previewLines count:", previewLines.length);
  console.log("🟠 [InlineDiffViewer] originalLines sample:", originalLines.slice(0, 3));
  console.log("🟠 [InlineDiffViewer] previewLines sample:", previewLines.slice(0, 3));

  const diffs = computeLineDiff(originalLines, previewLines);

  console.log("🟠 [InlineDiffViewer] diffs computed:", diffs.length, "lines");
  console.log("🟠 [InlineDiffViewer] diffs sample:", diffs.slice(0, 5));

  console.log("🟠 [InlineDiffViewer] About to render", diffs.length, "diff lines");

  return (
    <div className="inline-diff-viewer">
      {diffs.map((diff, index) => {
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
          return (
            <p key={`diff-${index}`} className="diff-line diff-line-insert">
              {diff.text}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}
