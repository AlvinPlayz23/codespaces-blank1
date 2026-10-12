# Grokbot

An unofficial, original implementation of the **Grok chat experience** — dark UI,
streaming answers, conversation history and a model picker — built from scratch.
It is not affiliated with xAI, ships no xAI code or assets, and talks to Grok only
through xAI's public, OpenAI-compatible API.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime / bundler | [Bun](https://bun.sh) (full-stack dev server, HTML imports) |
| UI | React 19 + TypeScript |
| Storage | SQLite via `bun:sqlite` |
| Streaming | Server-sent events end to end |
| Markdown | `marked` + `dompurify` + `highlight.js` |

## Quickstart

```bash
bun install
bun run dev        # http://localhost:3000
```

No API key is required to try it: without `XAI_API_KEY` the app runs in **demo
mode**, where a local generator streams plausible replies so every part of the
UI (streaming, markdown, code blocks, history) is exercisable.

## Real Grok replies

```bash
cp .env.example .env
# put a key from https://console.x.ai into XAI_API_KEY
bun run start
```

`XAI_BASE_URL` defaults to `https://api.x.ai/v1` and `XAI_MODEL` to `grok-4.7`.
Any OpenAI-compatible endpoint works too — point `XAI_BASE_URL` at Ollama, LM
Studio or vLLM and the same streaming path is used.

## Features

- Streaming assistant replies with a live markdown renderer, syntax-highlighted
  code blocks and copy buttons
- Sidebar with chat history, auto-generated titles, delete, and new chat
- Model picker persisted in `localStorage`
- Stop generation (the partial answer is kept), regenerate the last answer
- SQLite persistence — reload the page and your history is still there
- Responsive layout: off-canvas sidebar on narrow screens

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Demo-mode flag, default model, model catalog |
| `GET` | `/api/conversations` | List chats with message counts |
| `POST` | `/api/conversations` | Create a chat |
| `GET` | `/api/conversations/:id` | Chat metadata + messages |
| `PATCH` | `/api/conversations/:id` | Rename a chat |
| `DELETE` | `/api/conversations/:id` | Delete a chat |
| `POST` | `/api/conversations/:id/messages` | Send a message, stream the reply (SSE) |
| `POST` | `/api/conversations/:id/regenerate` | Drop the last answer and stream a new one |

## Layout

```text
src/
  server.ts          Bun.serve routes, SSE streaming, REST API
  db.ts              bun:sqlite schema and queries
  upstream.ts        xAI client + local demo generator
  shared/types.ts    types shared by server and client
  client/            React app (index.html entry, components, styles)
data/                SQLite database (gitignored)
```

## Notes

- `GROKBOT_DB` overrides the database path, `PORT` the listen port.
- `bun run typecheck` runs `tsc --noEmit`.
