/*
 * SpotMe — chat route (Groq / Llama edition)
 * ------------------------------------------------------------
 * POST /api/chat   requires auth
 *   body: {
 *     sessionId?: number,
 *     message:   string,
 *     imageDataUrl?: string   // optional base64 image
 *   }
 *   returns: { sessionId, reply, messageId }
 *
 * Routes messages through Groq:
 *   - Text-only messages → GROQ_CHAT_MODEL (llama-3.3-70b-versatile)
 *   - Messages with images → GROQ_VISION_MODEL (llama-3.2-11b-vision-preview)
 *
 * Groq's SDK speaks OpenAI's message format:
 *   role: 'system' | 'user' | 'assistant'
 *   content: string OR [{type:'text',text},{type:'image_url',image_url:{url}}]
 * ------------------------------------------------------------ */

import express from 'express';
import Groq from 'groq-sdk';
import { stmts } from '../db.js';
import { ApiError, requireAuth, handler } from './_shared.js';

export const chatRoutes = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const CHAT_MODEL   = process.env.GROQ_CHAT_MODEL   || 'llama-3.3-70b-versatile';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';

/* ---------- language name map ---------- */

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic',
  de: 'German', pt: 'Portuguese', it: 'Italian',
  zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean',
};

/* ---------- system prompt ---------- */

function buildSystemPrompt(user, language = 'en') {
  const langName = LANG_NAMES[language] || 'English';
  const bits = [
    `You are SpotMe Coach — a concise, encouraging AI personal trainer inside the SpotMe app. Always respond in ${langName}.`,
    "Format replies with short paragraphs. Use bullet or numbered lists for workouts (exercise · sets x reps · rest).",
    "Always tailor recommendations to the user's profile below. If the user asks about something unrelated to fitness, answer briefly and steer back to training.",
    "",
    "User profile:",
    `- Name: ${user.first_name || 'Athlete'} ${user.last_name || ''}`.trim(),
    `- Experience level: ${user.level || 'unspecified'}`,
    `- Weight: ${user.weight ? `${user.weight} ${user.weight_unit || ''}`.trim() : 'unspecified'}`,
    `- Height: ${user.height ? `${user.height} ${user.height_unit || ''}`.trim() : 'unspecified'}`,
    user.plays_sport === 'Yes' && user.sport_name ? `- Plays: ${user.sport_name}` : null,
    user.training_goal ? `- Primary training goal: ${user.training_goal}` : null
  ].filter(Boolean);
  return bits.join('\n');
}

/* ---------- POST /api/chat ---------- */

chatRoutes.post('/', requireAuth, handler(async (req, res) => {
  const message = (req.body.message || '').trim();
  const imageDataUrl = req.body.imageDataUrl || null;
  const language = req.body.language || 'en';

  if (!message && !imageDataUrl) throw new ApiError(400, 'Message or image is required.');
  if (message.length > 4000)      throw new ApiError(400, 'Message is too long (max 4000 chars).');

  /* ---- resolve or create session ---- */
  let sessionId = Number(req.body.sessionId) || null;
  if (sessionId) {
    const sess = stmts.getSession.get(sessionId, req.user.id);
    if (!sess) throw new ApiError(404, 'Conversation not found.');
  } else {
    const title = message.slice(0, 60) || 'New conversation';
    const info = stmts.createSession.run(req.user.id, title, '');
    sessionId = Number(info.lastInsertRowid);
  }

  /* ---- store the user message ---- */
  stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'user',
    content:         message,
    image_data_url:  imageDataUrl,
    structured_json: null
  });

  /* ---- build the OpenAI-style messages array from history ---- */
  const history = stmts.listMessages.all(sessionId);
  const systemPrompt = buildSystemPrompt(req.user, language);

  // Detect whether any message in this conversation has an image.
  // Llama vision models have stricter constraints (no system message with
  // some variants, smaller context), so we only switch to vision when
  // there's actually an image in play.
  const hasAnyImage = history.some(m => m.image_data_url);
  const model = hasAnyImage ? VISION_MODEL : CHAT_MODEL;

  const messages = [];
  // Groq's vision models accept system messages since late 2024, but to be
  // safe and keep our prompt intact, we always include it.
  messages.push({ role: 'system', content: systemPrompt });
  for (const m of history) {
    if (m.image_data_url && m.role === 'user') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: m.content || 'What is this?' },
          { type: 'image_url', image_url: { url: m.image_data_url } }
        ]
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  /* ---- call Groq ---- */
  let replyText;
  try {
    const completion = await groq.chat.completions.create({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.6
    });
    replyText = completion.choices?.[0]?.message?.content?.trim() || '(Empty reply.)';
  } catch (e) {
    console.error('[spotme] Groq call failed:', e?.status, e?.message || e);
    const status = e?.status;
    if (status === 401) {
      throw new ApiError(500, 'The server is misconfigured — check your Groq API key.');
    }
    if (status === 429) {
      throw new ApiError(503, "I've hit a rate limit. Give me a minute and try again.");
    }
    if (status === 413) {
      throw new ApiError(413, 'That image is too large for the vision model.');
    }
    throw new ApiError(502, "I can't reach my brain right now. Try again in a moment.");
  }

  /* ---- store the assistant message ---- */
  const info = stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'assistant',
    content:         replyText,
    image_data_url:  null,
    structured_json: null
  });
  stmts.touchSession.run(sessionId);

  res.json({
    sessionId,
    reply: replyText,
    messageId: Number(info.lastInsertRowid)
  });
}));

/* ---------- POST /api/chat/stream — SSE streaming ---------- */

chatRoutes.post('/stream', requireAuth, handler(async (req, res) => {
  const message = (req.body.message || '').trim();
  const imageDataUrl = req.body.imageDataUrl || null;
  const language = req.body.language || 'en';

  if (!message && !imageDataUrl) throw new ApiError(400, 'Message or image is required.');
  if (message.length > 4000)      throw new ApiError(400, 'Message is too long (max 4000 chars).');

  /* ---- resolve or create session ---- */
  let sessionId = Number(req.body.sessionId) || null;
  if (sessionId) {
    const sess = stmts.getSession.get(sessionId, req.user.id);
    if (!sess) throw new ApiError(404, 'Conversation not found.');
  } else {
    const title = message.slice(0, 60) || 'New conversation';
    const info = stmts.createSession.run(req.user.id, title, '');
    sessionId = Number(info.lastInsertRowid);
  }

  /* ---- store the user message ---- */
  stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'user',
    content:         message,
    image_data_url:  imageDataUrl,
    structured_json: null
  });

  /* ---- build messages array ---- */
  const history = stmts.listMessages.all(sessionId);
  const systemPrompt = buildSystemPrompt(req.user, language);
  const hasAnyImage = history.some(m => m.image_data_url);
  const model = hasAnyImage ? VISION_MODEL : CHAT_MODEL;

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    if (m.image_data_url && m.role === 'user') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: m.content || 'What is this?' },
          { type: 'image_url', image_url: { url: m.image_data_url } }
        ]
      });
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }

  /* ---- SSE headers ---- */
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  /* ---- send sessionId first so the client can persist it ---- */
  send('session', { sessionId });

  /* ---- stream from Groq ---- */
  let replyText = '';
  try {
    const stream = await groq.chat.completions.create({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.6,
      stream: true
    });
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        replyText += delta;
        send('chunk', { text: delta });
      }
    }
  } catch (e) {
    const status = e?.status;
    const detail = e?.message || String(e);
    console.error('[spotme] Groq stream failed:', status, detail);
    if (status === 401) send('error', { message: 'Server misconfigured — check GROQ_API_KEY.' });
    else if (status === 429) send('error', { message: "Rate limited. Give me a minute and try again." });
    else if (status === 413) send('error', { message: 'Image too large for the vision model.' });
    else if (status === 400) send('error', { message: `Bad request to AI (${detail}).` });
    else send('error', { message: `AI error ${status || '(network)'}: ${detail}` });
    res.end();
    return;
  }

  if (!replyText) {
    send('error', { message: 'AI returned an empty response. Try again.' });
    res.end();
    return;
  }

  /* ---- store assistant reply ---- */
  const info = stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'assistant',
    content:         replyText,
    image_data_url:  null,
    structured_json: null
  });
  stmts.touchSession.run(sessionId);

  send('done', { messageId: Number(info.lastInsertRowid) });
  res.end();
}));
