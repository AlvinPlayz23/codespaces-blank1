import type { Conversation } from "../../shared/types";
import { CloseIcon, Logo, PlusIcon, TrashIcon } from "./Icons";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  demoMode: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  open,
  demoMode,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  return (
    <aside className={open ? "sidebar open" : "sidebar"}>
      <div className="sidebar-head">
        <div className="brand">
          <Logo size={18} />
          <span>Grokbot</span>
          <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <CloseIcon />
          </button>
        </div>
        <button type="button" className="new-chat" onClick={onNew}>
          <PlusIcon />
          <span>New chat</span>
        </button>
      </div>
      <nav className="conv-list">
        {conversations.length > 0 ? (
          <div className="conv-section-label">Chats</div>
        ) : (
          <div className="conv-empty">No chats yet — ask something to start one.</div>
        )}
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            role="button"
            tabIndex={0}
            className={conversation.id === activeId ? "conv-item active" : "conv-item"}
            onClick={() => onSelect(conversation.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(conversation.id);
              }
            }}
          >
            <span className="conv-title">{conversation.title}</span>
            <button
              type="button"
              className="conv-delete"
              aria-label={`Delete ${conversation.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(conversation.id);
              }}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="badge">{demoMode ? "Demo mode" : "xAI connected"}</span>
        <span>Unofficial Grok-style clone</span>
      </div>
    </aside>
  );
}
