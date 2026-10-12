import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../shared/types";
import { Logo } from "./Icons";
import { Markdown } from "./Markdown";

function MessageRow({ message, streaming = false }: { message: ChatMessage; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <div className={`msg ${isUser ? "msg-user" : "msg-assistant"}`}>
      {!isUser && (
        <div className="avatar" aria-hidden="true">
          <Logo size={16} />
        </div>
      )}
      <div className="msg-body">
        {isUser ? (
          <div className="bubble">{message.content}</div>
        ) : message.content ? (
          <>
            <Markdown source={message.content} streaming={streaming} />
            {!streaming && (
              <div className="msg-actions">
                <button type="button" onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </>
        ) : (
          <span className="thinking">
            <span />
            <span />
            <span />
          </span>
        )}
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  streamText: string;
  streaming: boolean;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
}

export function MessageList({
  messages,
  streamText,
  streaming,
  loading,
  error,
  onRegenerate,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamText, streaming]);

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="messages" ref={scrollRef} onScroll={handleScroll}>
      <div className="messages-inner">
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
        {(streaming || streamText) && (
          <MessageRow
            streaming
            message={{
              id: "streaming",
              conversationId: "",
              role: "assistant",
              content: streamText,
              model: null,
              createdAt: 0,
            }}
          />
        )}
        {loading && (
          <div className="loading-row">
            <span className="thinking">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
        {error && <div className="error-row">{error}</div>}
        {!streaming && lastMessage?.role === "assistant" && (
          <div className="regen-row">
            <button type="button" className="ghost-btn" onClick={onRegenerate}>
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
