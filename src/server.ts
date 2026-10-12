import index from "./client/index.html";
import * as store from "./db";
import type { AppConfig, ChatMessage, StreamEvent } from "./shared/types";
import { MODELS, defaultModel, isDemoMode, streamAssistant } from "./upstream";

const port = Number(process.env.PORT ?? 3000);

const json = (data: unknown, status = 200) => Response.json(data, { status });

function deriveTitle(content: string): string {
  const line = content.replace(/\s+/g, " ").trim();
  if (!line) return "New chat";
  return line.length > 48 ? `${line.slice(0, 47).trimEnd()}…` : line;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

interface StreamPrelude {
  userMessage?: ChatMessage;
  title?: string;
}

function sseResponse(
  request: Request,
  conversationId: string,
  history: ChatMessage[],
  model: string,
  prelude: StreamPrelude,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };

      if (prelude.userMessage) send({ type: "user_message", message: prelude.userMessage });
      if (prelude.title) send({ type: "title", title: prelude.title });

      let full = "";
      let failure: string | null = null;
      try {
        for await (const delta of streamAssistant(history, model, request.signal)) {
          full += delta;
          send({ type: "delta", text: delta });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          failure = error instanceof Error ? error.message : String(error);
        }
      }

      if (full) {
        // Persist whatever was produced, including a partial answer after the user hits stop.
        send({ type: "done", message: store.insertMessage(conversationId, "assistant", full, model) });
      }
      if (failure) send({ type: "error", message: failure });

      open = false;
      try {
        controller.close();
      } catch {
        // The client already went away.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function streamChat(request: Request, conversationId: string): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { content?: string; model?: string };
  const content = (body.content ?? "").trim();
  if (!content) return json({ error: "Message content is required" }, 400);
  const model = body.model?.trim() || defaultModel();

  const conversation = store.getConversation(conversationId)!;
  const firstMessage = store.listMessages(conversationId).length === 0;
  const userMessage = store.insertMessage(conversationId, "user", content, model);
  const title = firstMessage ? deriveTitle(content) : conversation.title;
  if (firstMessage) store.renameConversation(conversationId, title);

  const history = store.listMessages(conversationId);
  return sseResponse(request, conversationId, history, model, {
    userMessage,
    title: firstMessage ? title : undefined,
  });
}

async function streamRegenerate(request: Request, conversationId: string): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { model?: string };
  const previous = store.lastAssistantMessage(conversationId);
  if (previous) store.deleteMessage(previous.id);

  const history = store.listMessages(conversationId);
  if (history.length === 0) return json({ error: "Nothing to regenerate" }, 400);

  const model = body.model?.trim() || previous?.model || defaultModel();
  return sseResponse(request, conversationId, history, model, {});
}

async function handleApi(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const parts = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method.toUpperCase();

  if (parts[0] === "config" && parts.length === 1 && method === "GET") {
    const config: AppConfig = { demoMode: isDemoMode(), defaultModel: defaultModel(), models: MODELS };
    return json(config);
  }

  if (parts[0] !== "conversations") return json({ error: "Not found" }, 404);

  if (parts.length === 1) {
    if (method === "GET") return json(store.listConversations());
    if (method === "POST") return json(store.createConversation(), 201);
    return json({ error: "Method not allowed" }, 405);
  }

  const conversationId = parts[1]!;
  if (!store.getConversation(conversationId)) {
    return json({ error: "Conversation not found" }, 404);
  }

  if (parts.length === 2) {
    if (method === "GET") {
      return json({
        conversation: store.getConversation(conversationId),
        messages: store.listMessages(conversationId),
      });
    }
    if (method === "DELETE") {
      store.deleteConversation(conversationId);
      return json({ ok: true });
    }
    if (method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as { title?: string };
      const title = (body.title ?? "").trim();
      if (!title) return json({ error: "Title is required" }, 400);
      store.renameConversation(conversationId, title.slice(0, 120));
      return json(store.getConversation(conversationId));
    }
    return json({ error: "Method not allowed" }, 405);
  }

  if (parts.length === 3 && parts[2] === "messages" && method === "POST") {
    return streamChat(request, conversationId);
  }
  if (parts.length === 3 && parts[2] === "regenerate" && method === "POST") {
    return streamRegenerate(request, conversationId);
  }
  return json({ error: "Not found" }, 404);
}

const server = Bun.serve({
  port,
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": index,
    "/api/*": (request) => handleApi(request),
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `Grokbot listening on http://localhost:${server.port}${isDemoMode() ? " (demo mode)" : ""}`,
);
