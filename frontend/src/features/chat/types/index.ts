export type DiffChunk = {
  type: "equal" | "insert" | "delete";
  text: string;
};

export type SuggestionScope = "document" | "selection";

export type LyricOption = {
  label: string;
  lyrics: string;
  diff: DiffChunk[];
  scope?: SuggestionScope;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  commentary?: string[];
  options?: LyricOption[];
  createdAt: number;
  status?: "pending" | "complete" | "error";
  error?: string;
  scope?: SuggestionScope;
};

export type ChatRequestPayload = {
  message: string;
  document_content: string;
  selection?: string | null;
  context: {
    document_id: string;
    document_version_id?: string | null;
    metadata?: Record<string, string> | null;
  };
};

export type ChatResponsePayload = {
  commentary: string[];
  options: LyricOption[];
};
