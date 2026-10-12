import { Logo } from "./Icons";

const SUGGESTIONS = [
  "Explain quantum computing like I'm five",
  "Write a TypeScript debounce function",
  "Draft a friendly reminder email for a late invoice",
  "Compare Rust and Go for building CLI tools",
];

interface WelcomeProps {
  demoMode: boolean;
  onPick: (text: string) => void;
}

export function Welcome({ demoMode, onPick }: WelcomeProps) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-logo">
          <Logo size={30} />
        </div>
        <h1>What do you want to know?</h1>
        <p>
          {demoMode
            ? "Demo mode is on — replies are generated locally until XAI_API_KEY is set."
            : "Ask anything. Chats are stored locally in SQLite."}
        </p>
        <div className="chips">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => onPick(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
