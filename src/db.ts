import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ChatMessage, Conversation, Role } from "./shared/types";

const dbPath = process.env.GROKBOT_DB ?? join(import.meta.dir, "..", "data", "grokbot.db");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
`);

interface ConversationRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  model: string | null;
  created_at: number;
}

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messageCount: row.message_count,
});

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  model: row.model,
  createdAt: row.created_at,
});

const CONVERSATION_SELECT = `
  SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
`;

export function listConversations(): Conversation[] {
  return db
    .query<ConversationRow, []>(`${CONVERSATION_SELECT} GROUP BY c.id ORDER BY c.updated_at DESC`)
    .all()
    .map(toConversation);
}

export function getConversation(id: string): Conversation | null {
  const row = db
    .query<ConversationRow, [string]>(`${CONVERSATION_SELECT} WHERE c.id = ? GROUP BY c.id`)
    .get(id);
  return row ? toConversation(row) : null;
}

export function createConversation(title = "New chat"): Conversation {
  const now = Date.now();
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    [id, title, now, now],
  );
  return { id, title, createdAt: now, updatedAt: now, messageCount: 0 };
}

export function renameConversation(id: string, title: string): void {
  db.run("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?", [title, Date.now(), id]);
}

export function deleteConversation(id: string): void {
  db.transaction(() => {
    db.run("DELETE FROM messages WHERE conversation_id = ?", [id]);
    db.run("DELETE FROM conversations WHERE id = ?", [id]);
  })();
}

export function listMessages(conversationId: string): ChatMessage[] {
  return db
    .query<MessageRow, [string]>(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC",
    )
    .all(conversationId)
    .map(toMessage);
}

export function insertMessage(
  conversationId: string,
  role: Role,
  content: string,
  model: string | null,
): ChatMessage {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.run(
      "INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, conversationId, role, content, model, now],
    );
    db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conversationId]);
  })();
  return { id, conversationId, role, content, model, createdAt: now };
}

export function deleteMessage(id: string): void {
  db.run("DELETE FROM messages WHERE id = ?", [id]);
}

export function lastAssistantMessage(conversationId: string): ChatMessage | null {
  const row = db
    .query<MessageRow, [string]>(
      "SELECT * FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get(conversationId);
  return row ? toMessage(row) : null;
}
