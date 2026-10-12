import type { AppConfig, ChatMessage, Conversation } from "../../shared/types";
import { Composer } from "./Composer";
import { MenuIcon } from "./Icons";
import { MessageList } from "./MessageList";
import { ModelPicker } from "./ModelPicker";
import { Welcome } from "./Welcome";

interface ChatViewProps {
  config: AppConfig | null;
  conversation: Conversation | null;
  messages: ChatMessage[];
  streamText: string;
  streaming: boolean;
  loading: boolean;
  error: string | null;
  model: string;
  onModelChange: (id: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onRegenerate: () => void;
  onOpenSidebar: () => void;
}

export function ChatView({
  config,
  conversation,
  messages,
  streamText,
  streaming,
  loading,
  error,
  model,
  onModelChange,
  onSend,
  onStop,
  onRegenerate,
  onOpenSidebar,
}: ChatViewProps) {
  const showWelcome = messages.length === 0 && !streamText && !streaming && !loading;

  return (
    <main className="main">
      <header className="chat-head">
        <button type="button" className="icon-btn menu-btn" onClick={onOpenSidebar} aria-label="Open sidebar">
          <MenuIcon />
        </button>
        <div className="chat-title">{conversation?.title ?? "New chat"}</div>
        {config && (
          <ModelPicker
            models={config.models}
            value={model || config.defaultModel}
            onChange={onModelChange}
          />
        )}
      </header>
      {showWelcome ? (
        <Welcome demoMode={config?.demoMode ?? false} onPick={onSend} />
      ) : (
        <MessageList
          messages={messages}
          streamText={streamText}
          streaming={streaming}
          loading={loading}
          error={error}
          onRegenerate={onRegenerate}
        />
      )}
      <Composer
        streaming={streaming}
        disabled={!config}
        demoMode={config?.demoMode ?? false}
        focusToken={conversation?.id ?? null}
        onSend={onSend}
        onStop={onStop}
      />
    </main>
  );
}
