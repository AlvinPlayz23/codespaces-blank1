import { useEffect, useRef, useState } from "react";
import { SendIcon, StopIcon } from "./Icons";

interface ComposerProps {
  streaming: boolean;
  disabled: boolean;
  demoMode: boolean;
  focusToken: string | null;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({
  streaming,
  disabled,
  demoMode,
  focusToken,
  onSend,
  onStop,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusToken]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Ask anything"
          aria-label="Message"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape" && streaming) onStop();
          }}
        />
        {streaming ? (
          <button type="button" className="send-btn stop" onClick={onStop} aria-label="Stop generating">
            <StopIcon />
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <div className="composer-hint">
        {demoMode && <span className="badge">Demo mode</span>}
        <span>Grokbot can make mistakes. Verify important information.</span>
      </div>
    </div>
  );
}
