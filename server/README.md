# SpotMe — local server (Groq / Llama edition)

Runs a local API on `http://localhost:8787`. Also serves the frontend, so you only need one process running.

## First-time setup

### 1. Node.js 18+

```bash
node --version
```

If that errors or prints v16 or older, install Node LTS from https://nodejs.org/.

### 2. Get a free Groq API key

Go to **https://console.groq.com/keys**, sign in (Google or GitHub work, no credit card required), click **Create API Key**, give it any name, copy the key (starts with `gsk_...`).

Free tier: **30 requests/minute, 14,400 requests/day.** That's more than enough for dev + demo.

### 3. Configure

```bash
cd server
cp .env.example .env
```

On Windows CMD use `copy .env.example .env`.

Open `.env`, replace `REPLACE_ME` with your Groq key, save.

### 4. Install

```bash
npm install
```

### 5. Run

```bash
npm start
```

Expected output:

```
[spotme] API + frontend listening on http://localhost:8787
[spotme] Chat model:   llama-3.3-70b-versatile
[spotme] Vision model: meta-llama/llama-4-scout-17b-16e-instruct
[spotme] Open http://localhost:8787 in your browser.
```

Open http://localhost:8787.

## Development mode (auto-restart)

```bash
npm run dev
```

## Troubleshooting

**"FATAL: GROQ_API_KEY is not set in .env"**
You didn't edit `.env`, or you edited `.env.example` by mistake, or Windows saved it as `.env.txt` (turn on Explorer → View → Show → File name extensions to check).

**401 Unauthorized in the server log**
Your Groq key is wrong or revoked. Generate a new one at https://console.groq.com/keys.

**429 rate-limit errors**
You're sending requests faster than Groq's free tier allows (30/min). Wait a minute. If it's persistent, you may need to upgrade or space out test requests.

**404 / model_decommissioned error**
Groq rotates models. Check https://console.groq.com/docs/deprecations for the current replacement and update `GROQ_VISION_MODEL` or `GROQ_CHAT_MODEL` in `.env` accordingly.

**Image upload fails with 413**
The image is over 4 MB. Resize it.

## Files

- `spotme.sqlite` — users + chat history. Delete to wipe everything.
- `uploads/` — temp storage (auto-cleaned).
- `.env` — your config. **Never commit.**
