export type Role = "user" | "assistant";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  model: string | null;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
}

export interface AppConfig {
  demoMode: boolean;
  defaultModel: string;
  models: ModelInfo[];
}

export type StreamEvent =
  | { type: "user_message"; message: ChatMessage }
  | { type: "title"; title: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };
