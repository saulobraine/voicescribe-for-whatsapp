# agents.md

Operational context for AI agents working on this project.

## What This Is

A Chromium/Edge **Manifest V3 browser extension** that transcribes WhatsApp Web voice messages using Google's Gemini API. The user supplies their own Gemini API key (BYOK model). No backend server.

## Repository Layout

Single flat directory. No build step, no package.json.

| File            | Role                                                                 |
|-----------------|----------------------------------------------------------------------|
| `manifest.json` | MV3 manifest: service worker, content script, web-accessible resource |
| `background.js` | Service worker — talks to Gemini API (model listing, transcription, file upload/delete) |
| `content.js`    | Content script in `web.whatsapp.com` — injects transcribe buttons, captures audio, shows result bubbles |
| `interceptor.js` | Injected into page context — intercepts fetch/XHR/createObjectURL to detect audio downloads |
| `popup.html`    | Popup UI markup (360px, vanilla HTML/CSS)                            |
| `popup.js`      | Popup logic — key/model config, model listing, connection test        |
| `README.md`     | User-facing installation guide                                        |

## Key Architectural Notes

- **Isolated world boundary**: `content.js` runs in the content script's isolated world and cannot see `fetch`/`XMLHttpRequest` calls made by WhatsApp's page scripts. `interceptor.js` is injected as a `<script>` tag (web-accessible resource) so it runs in the **page context**, where it can intercept those calls and re-broadcast them to `content.js` via a `CustomEvent('wgt-audio')`.

- **Service worker lifecycle**: `background.js` is an MV3 service worker. It wakes on message, does its async work, responds, and shuts down. `chrome.runtime.sendMessage` from `content.js` uses the callback form (with `return true` for async response).

- **Two transcription paths**:
  1. **Standard multimodal** (`gemini-{n}.flash/pro`): audio sent as base64 `inlineData` in a `generateContent` call.
  2. **Dedicated transcriber** (`gemini-3.5-transcribe`): uses the Files API (resumable upload) + Interactions API `/v1beta/interactions` with `transcription_config.mode: 'smart'`; uploaded file is deleted afterward.

- **Model filtering**: `isAudioInputModel()` in `background.js` filters out live/TTS/image/embedding models via regex. The allowlist targets `gemini-(3.8|3.7|3.6|3.5|3.1|3|2.5)-(flash|pro)` patterns.

## Setup & Development

1. `edge://extensions/` → enable **Developer mode** → **Load unpacked** → select this folder.
2. Navigate to `https://web.whatsapp.com/`.
3. Open the extension popup → enter Gemini API key → click **Refresh** to populate the model dropdown → **Save**.
4. Open a WhatsApp chat with a voice message — a 🎙 "Transcrever" button should appear next to audio players.

## Testing & Validation

- **Popup "Test" button**: validates API key + selected model connectivity without sending real audio.
- **Manual end-to-end testing** is the primary validation method (no automated tests exist).

## Conventions

- **Language**: all code comments, error messages, and UI strings are in **Portuguese**.
- **No linter / formatter** configured. No `package.json`.
- JavaScript is **vanilla ES6+** — no frameworks, no transpilation.
- All files use semicolons and standard callback/Promise patterns.

## Gotchas & Limitations

- The model names in the code (`gemini-3.8-flash`, `gemini-3.5-transcribe`) **do not match currently public Gemini models** (as of latest stable). These may be placeholders for future versions.
- Audio blob URLs must be converted via `fetch` before sending to the background; the code throws an error if a blob URL is passed directly to `urlToDataUrl()`.
- No retry logic on Gemini API failures — transient errors surface directly to the user.
- WhatsApp Web DOM changes can break the audio-player selectors in `content.js` (e.g., `[data-testid="audio-player-wrapper"]`).
- Video messages may also be processed if they contain audio tracks, though this isn't explicitly tested.

## Useful Commands (for an agent)

Since there's no build system, the main commands are for **loading/unloading the extension** in the browser for manual verification. No `npm`, `pnpm`, or test runner is needed.

## Security Notes

- The API key is stored in `chrome.storage.local` — **never** sent to any server other than `generativelanguage.googleapis.com` / `upload.googleapis.com`.
- Model selection is sanitized via `sanitizeModel()` which enforces a strict allowlist character regex before interpolation into API URLs.
- `interceptor.js` deliberately ignores telemetry URLs (`dit.whatsapp.net`, strings containing `telemetry`).

## XP Principles Applied

- **TDD**: All new functionality must have a corresponding test before implementation.
- **Simple Design**: Code is kept minimal and focused on a single responsibility.
- **Continuous Integration**: Small, frequent changes with immediate verification.
- **Refactoring**: Continuous improvements made only after successful testing.
- **Acceptance Testing**: Each feature has clear acceptance criteria validated with the user.

## How Agents Should Work

- **Start Small**: Implement the smallest possible functionality that solves a specific problem.
- **Test First**: Write tests for new functionality before implementing it.
- **Refactor Constantly**: Keep code clean and maintainable through frequent small refactorings.
- **Collaborate**: When working in pairs, share context and review code frequently.
- **Stay Focused**: Avoid scope creep — only implement what's explicitly requested.

## Security Notes for Agents

- The API key is stored in `chrome.storage.local` — **never** send it to any server other than `generativelanguage.googleapis.com` / `upload.googleapis.com`.
- Model selection is sanitized via `sanitizeModel()` which enforces a strict allowlist character regex before interpolation into API URLs.
- `interceptor.js` deliberately ignores telemetry URLs (`dit.whatsapp.net`, strings containing `telemetry`).
- All data stays in the user's browser — no external servers are used for storage or processing.

## How to Work With This Project

1. **Understand the Flow**: Audio → Interceptor → Content Script → Background Service Worker → Gemini API → Response → UI
2. **Test Incrementally**: Verify each component works before integrating
3. **Use Console Logs**: Add `console.log()` statements to trace data flow
4. **Check Manifest**: Verify permissions are correctly set
5. **Test Edge Cases**: Try different audio formats, message types, and network conditions

## Common Pitfalls

- **Missing Permissions**: Ensure all required `host_permissions` are in `manifest.json`
- **Storage Issues**: Verify `chrome.storage.local` is being used correctly
- **API Key Issues**: Verify the Gemini API key is valid and has proper permissions
- **Content Script Conflicts**: WhatsApp Web changes can break selectors — test frequently

## How to Contribute

1. **Fork** the repository
2. Create a new branch for your feature
3. Write tests for your changes
4. Implement the feature
5. Run all tests
6. Submit a pull request

This project values clean code, minimal dependencies, and clear communication. All contributions should follow these principles.
