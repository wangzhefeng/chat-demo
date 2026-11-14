# chat-demo

English | [简体中文](README.zh-CN.md)

A static chat demo powered by the DeepSeek API. No application backend is required: the browser connects directly to the configured API service.

You can [try the app online](https://deepseek-ai.github.io/chat-demo/) or download the archive from [Releases](https://github.com/deepseek-ai/deepseek-chat-demo/releases), extract it, and double-click `index.html` to use it locally without installation or a build. Enter your API key in Settings before your first chat.

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/deepseek-ai/chat-demo.git
cd chat-demo
pnpm install
pnpm dev
```

Open http://localhost:8090.

To build the static site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to a static web server or open `dist/index.html` directly. Opening the file directly requires browser support for storage on `file://` pages and an API service that permits their cross-origin requests.

## Features

- Multiple conversations with automatic titles, renaming, and deletion; edit prompts, regenerate replies, and switch between message branches.
- Build editable research prompts from general research, technology selection, product comparison, and fact-checking templates, with scope and multiple source URLs.
- Inspect sources and evidence separately from chat: distinguish search hits, confirmed reads, read failures, and citations without inferring unsupported read states.
- Turn answers into independently stored reports; edit and preview Markdown, save locally, and export reports with inline source links, evidence states, and research timestamps.
- Request AI edits for selected report text, review line differences, accept or reject suggestions, and restore saved snapshots. Stale, cancelled, failed, refused, or incomplete results never overwrite the report.
- Organize task descriptions, chats, notes, reports, and sources into topic workspaces with favorites, tags, and full-text search.
- Manually select workspace context for each request and inspect what was actually sent on the answer. Unselected content stays local; no vector database is used.
- Streaming replies, deep thinking, smart search, link reading, and source citations; stop generation or continue eligible replies.
- Upload, paste, or drag and drop attachments; use voice input and read replies aloud. A live audio spectrum appears in the first row of the input area while recording on mobile.
- Markdown, syntax highlighting, KaTeX math, and Mermaid diagrams.
- Simplified Chinese and English, light and dark themes, mobile layouts, location settings, and chat history import and export.

## Data and storage

Your API key and settings are stored in the browser's localStorage. Conversations and original attachments are stored in IndexedDB; reports and their historical snapshots use a separate `chat-demo-reports` IndexedDB database; workspaces, notes, and chat metadata use `chat-demo-workspaces`. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, using speech features, or requesting AI report edits sends the relevant content to the configured API service; AI edits include only the selected text, report title, and edit instruction.

Application backups in Settings use JSON and include complete chat message trees, reports, versions, workspaces, notes, and chat metadata. Original attachments, API keys, and settings are excluded. Imports are validated and replace corresponding local data after confirmation; a failed write triggers an attempted rollback to the pre-import snapshot.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, reports, and original non-image attachments. Reports are exported separately as Markdown. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key, settings, reports, workspaces, notes, and chat metadata are preserved; files already uploaded to the API service are not deleted.

## Development

| Command       | Description                  |
| ------------- | ---------------------------- |
| `pnpm dev`    | Start the development server |
| `pnpm build`  | Build into `dist/`           |
| `pnpm type`   | Run TypeScript type checks   |
| `pnpm lint`   | Lint with oxlint             |
| `pnpm test`   | Run Vitest regression tests  |
| `pnpm format` | Format with oxfmt            |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default through Anthropic-compatible Messages / Files APIs. Speech features use ASR / TTS endpoints. Requests include extensions for search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    reports/           Independent report storage, editing state, and export
    research.ts        Research templates, prompt construction, and URL validation
    workspaces/        Workspaces, notes, search, and explicit request context
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
