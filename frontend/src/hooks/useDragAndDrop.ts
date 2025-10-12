import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { SunoTag } from "@/data/suno-tags";

type UseDragAndDropProps = {
  editor: Editor | null;
};

export function useDragAndDrop({ editor }: UseDragAndDropProps) {
  const formatTag = useCallback((tag: SunoTag): string => {
    if (tag.format === "bracket") {
      return `[${tag.label}]`;
    } else {
      return `*${tag.label}*`;
    }
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent, tag: SunoTag) => {
    // Store tag data in the drag event
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/json", JSON.stringify(tag));
    event.dataTransfer.setData("text/plain", formatTag(tag));

    // Add visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "0.5";
    }
  }, [formatTag]);

  const handleDragEnd = useCallback((event: React.DragEvent) => {
    // Reset visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editor) {
        return;
      }

      try {
        // Try to parse the tag data
        const jsonData = event.dataTransfer.getData("application/json");
        const plainText = event.dataTransfer.getData("text/plain");

        let tagText = plainText;

        if (jsonData) {
          const tag = JSON.parse(jsonData) as SunoTag;
          tagText = formatTag(tag);
        }

        // Insert tag at current cursor position
        // Add space before if there's text before cursor
        const { from, to } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from);
        const textAfter = editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size, to + 1));

        let textToInsert = tagText;

        // Add spacing if needed
        if (textBefore && textBefore !== " " && textBefore !== "\n") {
          textToInsert = " " + textToInsert;
        }
        if (textAfter && textAfter !== " " && textAfter !== "\n") {
          textToInsert = textToInsert + " ";
        }

        editor
          .chain()
          .focus()
          .insertContent(textToInsert)
          .run();

      } catch (error) {
        console.error("Error handling drop:", error);
      }
    },
    [editor, formatTag]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  return {
    formatTag,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleDragOver,
  };
}
