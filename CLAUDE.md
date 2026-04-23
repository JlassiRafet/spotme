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

## Workflow (Boris Cherny Tips)

**Tip 1 — Parallel work:** Use git worktrees for parallel features.
Commands: `git worktree add -b feat/X ../spotme-X master`
Aliases: za=worktree1, zb=worktree2, zc=worktree3

**Tip 2 — Plan first:** Use `/plan <task>` before any complex change.
Never code without approved plan. Re-plan when stuck.

**Tip 3 — Living CLAUDE.md:** After every correction, update this file.
Rule format: what to do → why → when it applies.

**Tip 4 — Slash commands:**
- `/compact` — compress conversation to bullet points
- `/techdebt` — find and kill duplicated/dead code
- `/plan <task>` — write plan, wait for approval

**Tip 5 — Let Claude debug:** Say "fix" + paste error. Don't micromanage.

**Tip 6 — Challenge prompting:**
- "Grill me on this before we PR"
- "Scrap that, implement elegant solution"
- "Prove this works, show me the diff"

**Tip 8 — Subagents:** Append "use subagents" to heavy parallel tasks.

**Tip 10 — Self-update rule:** After every correction end with:
"Update CLAUDE.md so you don't make that mistake again."

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
