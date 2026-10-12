import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig, ChatMessage, Conversation, StreamEvent } from "../shared/types";
import { api, streamChat } from "./api";
import { ChatView } from "./components/ChatView";
import { Sidebar } from "./components/Sidebar";

const MODEL_STORAGE_KEY = "grokbot:model";

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const streamingRef = useRef(false);
  activeIdRef.current = activeId;
  conversationsRef.current = conversations;
  streamingRef.current = streaming;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, list] = await Promise.all([api.config(), api.conversations()]);
        if (cancelled) return;
        setConfig(cfg);
        setConversations(list);
        const stored = localStorage.getItem(MODEL_STORAGE_KEY);
        setModel(stored && cfg.models.some((m) => m.id === stored) ? stored : cfg.defaultModel);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Grokbot");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const abortActiveStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
    setStreamText("");
  }, []);

  const discardEmptyConversation = useCallback((id: string | null) => {
    if (!id || streamingRef.current) return;
    const conversation = conversationsRef.current.find((candidate) => candidate.id === id);
    if (!conversation || conversation.messageCount > 0) return;
    setConversations((prev) => prev.filter((candidate) => candidate.id !== id));
    void api.remove(id).catch(() => {});
  }, []);

  const runStream = useCallback(
    async (conversationId: string, path: string, body: { content?: string; model: string }) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setStreaming(true);
      setStreamText("");
      let completed = false;
      let aborted = false;
      try {
        await streamChat(
          path,
          body,
          (event: StreamEvent) => {
            switch (event.type) {
              case "user_message":
                setMessages((prev) => [...prev, event.message]);
                break;
              case "title":
                setConversations((prev) =>
                  prev.map((c) => (c.id === conversationId ? { ...c, title: event.title } : c)),
                );
                break;
              case "delta":
                setStreamText((prev) => prev + event.text);
                break;
              case "done":
                completed = true;
                setMessages((prev) => [...prev, event.message]);
                setStreamText("");
                break;
              case "error":
                setError(event.message);
                break;
            }
          },
          controller.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          aborted = true;
        } else {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
        if (completed) {
          void api.conversations().then(setConversations).catch(() => {});
        } else if (!aborted) {
          setStreamText("");
        }
      }
    },
    [],
  );

  const stopStreaming = useCallback((id: string | null) => {
    if (!abortRef.current) return;
    abortRef.current.abort();
    abortRef.current = null;
    setStreaming(false);
    if (!id) {
      setStreamText("");
      return;
    }
    // The server persists the partial answer on abort; pick it up shortly after.
    window.setTimeout(async () => {
      try {
        const { messages: fresh } = await api.conversation(id);
        if (activeIdRef.current === id) {
          setMessages(fresh);
          setStreamText("");
        }
        void api.conversations().then(setConversations).catch(() => {});
      } catch {
        setStreamText("");
      }
    }, 250);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streamingRef.current) return;
      let id = activeIdRef.current;
      if (!id) {
        try {
          const conversation = await api.createConversation();
          id = conversation.id;
          setConversations((prev) => [conversation, ...prev]);
          setActiveId(conversation.id);
          setMessages([]);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to start a chat");
          return;
        }
      }
      void runStream(id, `/api/conversations/${id}/messages`, {
        content,
        model: model || config?.defaultModel || "",
      });
    },
    [config?.defaultModel, model, runStream],
  );

  const regenerate = useCallback(() => {
    const id = activeIdRef.current;
    if (!id || streamingRef.current) return;
    setMessages((prev) => {
      const next = [...prev];
      while (next.length > 0 && next[next.length - 1]!.role === "assistant") next.pop();
      return next;
    });
    void runStream(id, `/api/conversations/${id}/regenerate`, { model: model || config?.defaultModel || "" });
  }, [config?.defaultModel, model, runStream]);

  const selectConversation = useCallback(
    async (id: string) => {
      setSidebarOpen(false);
      if (id === activeIdRef.current && !streamingRef.current) return;
      const previousId = activeIdRef.current;
      abortActiveStream();
      discardEmptyConversation(previousId);
      setActiveId(id);
      setMessages([]);
      setError(null);
      setLoadingConversation(true);
      try {
        const { conversation, messages: list } = await api.conversation(id);
        if (activeIdRef.current !== id) return;
        setMessages(list);
        setConversations((prev) => prev.map((c) => (c.id === conversation.id ? conversation : c)));
      } catch (err) {
        if (activeIdRef.current === id) {
          setError(err instanceof Error ? err.message : "Failed to load chat");
        }
      } finally {
        if (activeIdRef.current === id) setLoadingConversation(false);
      }
    },
    [abortActiveStream, discardEmptyConversation],
  );

  const newChat = useCallback(() => {
    const previousId = activeIdRef.current;
    abortActiveStream();
    discardEmptyConversation(previousId);
    setActiveId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  }, [abortActiveStream, discardEmptyConversation]);

  const removeConversation = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this chat?")) return;
      if (id === activeIdRef.current) {
        abortActiveStream();
        setActiveId(null);
        setMessages([]);
      }
      try {
        await api.remove(id);
        setConversations((prev) => prev.filter((candidate) => candidate.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete chat");
      }
    },
    [abortActiveStream],
  );

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        demoMode={config?.demoMode ?? false}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectConversation}
        onNew={newChat}
        onDelete={removeConversation}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <ChatView
        config={config}
        conversation={conversations.find((c) => c.id === activeId) ?? null}
        messages={messages}
        streamText={streamText}
        streaming={streaming}
        loading={loadingConversation}
        error={error}
        model={model}
        onModelChange={(id) => {
          setModel(id);
          localStorage.setItem(MODEL_STORAGE_KEY, id);
        }}
        onSend={send}
        onStop={() => stopStreaming(activeIdRef.current)}
        onRegenerate={regenerate}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </div>
  );
}
