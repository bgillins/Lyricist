export type DiffChunk = {
  type: "equal" | "insert" | "delete";
  text: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  diff?: DiffChunk[];
  commentary?: string[];
  suggestedContent?: string;
  createdAt: number;
  status?: "pending" | "complete" | "error";
  error?: string;
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
  lyrics: string;
  diff: DiffChunk[];
};
