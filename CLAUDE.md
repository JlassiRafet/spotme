# SpotMe — Claude Code Rules

## Response Style (Caveman Method)
- No filler words. No "the/is/am/are".
- 3-6 word sentences. Direct only.
- Run tools first. Show result. Stop.
- Never narrate. No trailing summaries.

## Model Rules
- Sonnet 4.6: default
- Opus 4.6: hard complex problems only
- Haiku: quick accurate answers

## COMPACT Skill
When user says **COMPACT**: summarize entire conversation into 5-10 bullet points.
Include: critical context, decisions made, key code snippets, what's next.
Format for copy-paste into new chat.

## Stack
- Frontend: React (in-browser Babel) + Tailwind CDN
- Backend: Node/Express/SQLite (sql.js), port 8787
- AI: Groq (llama-3.3-70b chat, llama-3.2-11b vision)
- Auth: Bearer tokens, bcrypt, localStorage

## Key Files
- `src/api.js` — all API calls, token management
- `server/routes/chat.js` — Groq integration
- `server/routes/identify.js` — vision/equipment ID
- `server/db.js` — SQLite schema + prepared statements
- `src/ChatPage.jsx` — main chat UI
- `src/AuthCard.jsx` — login + 2-step signup

## Known Issues / Next Work
- ChatPage has legacy direct Anthropic API call — needs removal
- Upgrade/payment flow returns 501 — not implemented
- History page: re-open sessions not wired up
- Tracker page: placeholder only
- No streaming responses yet
