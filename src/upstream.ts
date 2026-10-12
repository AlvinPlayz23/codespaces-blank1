import type { ChatMessage, ModelInfo } from "./shared/types";

export const MODELS: ModelInfo[] = [
  { id: "grok-4.7", label: "Grok 4.7", description: "Flagship model for hard reasoning" },
  { id: "grok-4.7-fast", label: "Grok 4.7 Fast", description: "Faster answers for everyday chat" },
  { id: "grok-4", label: "Grok 4", description: "Previous generation flagship" },
  { id: "grok-3-mini", label: "Grok 3 Mini", description: "Compact and cheap for quick tasks" },
];

const baseUrl = () => process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1";

export function defaultModel(): string {
  return process.env.XAI_MODEL?.trim() || MODELS[0]!.id;
}

export function isDemoMode(): boolean {
  return !process.env.XAI_API_KEY?.trim();
}

export async function* streamAssistant(
  history: ChatMessage[],
  model: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  if (isDemoMode()) {
    yield* streamDemo(history, signal);
    return;
  }
  yield* streamXai(history, model, signal);
}

async function* streamXai(
  history: ChatMessage[],
  model: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: history.map((message) => ({ role: message.role, content: message.content })),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`xAI request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Keep-alive comments and partial frames are not JSON.
      }
    }
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function* streamDemo(history: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const lastUser = [...history].reverse().find((message) => message.role === "user")?.content ?? "";
  const reply = demoReply(lastUser);
  const tokens = reply.match(/\S+\s*/g) ?? [reply];
  await sleep(250);
  for (const token of tokens) {
    if (signal.aborted) return;
    yield token;
    await sleep(12 + Math.random() * 30);
  }
}

function demoReply(prompt: string): string {
  const question = prompt.trim().replace(/\s+/g, " ");
  const lower = question.toLowerCase();
  const banner =
    "> **Demo mode** — no `XAI_API_KEY` is configured, so this reply is generated locally. Add a key to `.env` to stream from the real Grok models.\n\n";

  if (/^(hi|hello|hey|yo|howdy|sup)\b/.test(lower)) {
    return (
      banner +
      "Hey — good to see you. I'm **Grokbot**, an unofficial clone of the Grok chat experience.\n\n" +
      "Things to try:\n\n" +
      "- Ask anything and watch the answer stream in token by token\n" +
      "- Start, switch and delete chats from the sidebar\n" +
      "- Pick a different model in the header\n" +
      "- Reload the page — history is persisted in SQLite\n\n" +
      "What do you want to poke at first?"
    );
  }

  if (/(who|what) are you|your name|about you/.test(lower)) {
    return (
      banner +
      "I'm **Grokbot** — an original, open implementation of the Grok chat experience:\n\n" +
      "| Piece | Choice |\n" +
      "| --- | --- |\n" +
      "| Runtime | Bun |\n" +
      "| UI | React 19 + TypeScript |\n" +
      "| Storage | SQLite (`bun:sqlite`) |\n" +
      "| Streaming | Server-sent events |\n\n" +
      "Set `XAI_API_KEY` and I forward the same request to `api.x.ai`, so replies become real Grok output."
    );
  }

  if (/(code|function|script|program|debug|bug|error|python|javascript|typescript|react|sql|api)/.test(lower)) {
    return (
      banner +
      "Here's a compact TypeScript snippet for consuming a streaming endpoint:\n\n" +
      "```ts\n" +
      "export async function* stream(url: string, signal: AbortSignal) {\n" +
      "  const response = await fetch(url, { signal });\n" +
      "  const reader = response.body!.getReader();\n" +
      "  const decoder = new TextDecoder();\n" +
      "  let buffer = '';\n" +
      "  while (true) {\n" +
      "    const { done, value } = await reader.read();\n" +
      "    if (done) break;\n" +
      "    buffer += decoder.decode(value, { stream: true });\n" +
      "    const frames = buffer.split('\\n\\n');\n" +
      "    buffer = frames.pop() ?? '';\n" +
      "    for (const frame of frames) yield parseFrame(frame);\n" +
      "  }\n" +
      "}\n" +
      "```\n\n" +
      "Key ideas:\n\n" +
      "1. Keep a buffer, because network chunks do not align with SSE frames\n" +
      "2. Decode with `{ stream: true }` so multi-byte characters split across chunks survive\n" +
      "3. Pass an `AbortSignal` so the stop button actually cancels the upstream request\n\n" +
      "Swap in a real API key and this same loop is what streams Grok's replies into the page."
    );
  }

  return (
    banner +
    `You asked:\n\n> ${question || "(empty)"}\n\n` +
    "A few ways I could take that:\n\n" +
    "- **Explain** — walk through the background and the key moving parts\n" +
    "- **Compare** — line up the main options side by side\n" +
    "- **Build** — sketch an implementation with code you can run\n\n" +
    "Tell me which direction you want, or ask something new — with a real `XAI_API_KEY` this reply would come from Grok itself."
  );
}
