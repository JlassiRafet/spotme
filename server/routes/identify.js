/*
 * SpotMe — identify route (Groq / Llama vision edition)
 * ------------------------------------------------------------
 * POST /api/identify   requires auth
 *   body: { sessionId?, imageDataUrl }
 *   returns: {
 *     sessionId, messageId, assistantText,
 *     identification: {
 *       machineName, category, primaryMuscles, secondaryMuscles,
 *       steps, proTip, safetyNote
 *     }
 *   }
 *
 * Forces JSON output via Groq's response_format parameter. The schema
 * is described in the system prompt since Llama doesn't enforce a
 * server-side schema the way Gemini does.
 * ------------------------------------------------------------ */

import express from 'express';
import Groq from 'groq-sdk';
import { stmts } from '../db.js';
import { ApiError, requireAuth, handler } from './_shared.js';

export const identifyRoutes = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';

const IDENTIFY_SYSTEM = `You are SpotMe's vision coach. A user uploaded a photo from a gym.
Identify the primary piece of equipment or exercise shown.

You MUST reply with a valid JSON object matching this exact shape:
{
  "machineName":      string,
  "category":         string,
  "primaryMuscles":   string[],
  "secondaryMuscles": string[],
  "steps":            string[],
  "proTip":           string,
  "safetyNote":       string
}

Field rules:
- machineName: e.g. "Smith Machine", "Lat Pulldown", "Barbell Back Squat Rack". If the image does NOT show fitness equipment, set this to "UNCLEAR".
- category: one of "Upper body", "Lower body", "Full body", "Cardio", "Mobility".
- primaryMuscles: 1-3 muscle names in Title Case.
- secondaryMuscles: 0-4 supporting muscle names.
- steps: 4-7 short ordered instructions for safe, correct use.
- proTip: one concrete form or programming tip, max 140 chars.
- safetyNote: brief risk to watch for, max 140 chars.

Muscle names should come from this list where possible:
Pectoralis Major, Pectoralis Minor, Anterior Deltoid, Lateral Deltoid, Posterior Deltoid,
Biceps Brachii, Triceps Brachii, Forearms, Upper Trapezius, Middle Trapezius, Lower Trapezius,
Latissimus Dorsi, Rhomboids, Erector Spinae, Rectus Abdominis, Obliques,
Gluteus Maximus, Gluteus Medius, Quadriceps, Hamstrings, Adductors, Abductors,
Calves, Soleus, Tibialis Anterior, Hip Flexors.

If the image does NOT clearly show fitness equipment or an exercise,
return: {"machineName":"UNCLEAR","category":"Upper body","primaryMuscles":[],"secondaryMuscles":[],"steps":[],"proTip":"","safetyNote":""}

Output ONLY the JSON object. No prose before or after.`;

/* ---------- helpers ---------- */

function buildTags(ident) {
  const out = new Set();
  if (ident.machineName && ident.machineName !== 'UNCLEAR') {
    out.add(ident.machineName.toLowerCase().replace(/\s+/g, '-'));
  }
  if (ident.category) out.add(ident.category.toLowerCase().replace(/\s+/g, '-'));
  for (const m of (ident.primaryMuscles || [])) {
    out.add(m.toLowerCase().replace(/\s+/g, '-'));
  }
  return [...out].join(',');
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Second attempt: look for the first { ... } block. Some models add prose.
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

/* ---------- POST /api/identify ---------- */

identifyRoutes.post('/', requireAuth, handler(async (req, res) => {
  const imageDataUrl = req.body.imageDataUrl;
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
    throw new ApiError(400, 'A valid image is required.');
  }
  const approxBytes = (imageDataUrl.length * 3) / 4;
  // Groq Llama Vision has a 4MB-ish limit on base64 images.
  if (approxBytes > 4 * 1024 * 1024) {
    throw new ApiError(413, 'Image is too large. Please upload something under 4 MB.');
  }

  /* ---- resolve or create session ---- */
  let sessionId = Number(req.body.sessionId) || null;
  if (sessionId) {
    const sess = stmts.getSession.get(sessionId, req.user.id);
    if (!sess) throw new ApiError(404, 'Conversation not found.');
  } else {
    const info = stmts.createSession.run(req.user.id, 'Identifying equipment…', '');
    sessionId = Number(info.lastInsertRowid);
  }

  /* ---- store user's image message ---- */
  stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'user',
    content:         '[uploaded an image to identify]',
    image_data_url:  imageDataUrl,
    structured_json: null
  });

  /* ---- call Groq vision with JSON mode ---- */
  let ident = null;
  try {
    const completion = await groq.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: 'system', content: IDENTIFY_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Identify this and return the JSON.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ]
    });
    const raw = completion.choices?.[0]?.message?.content;
    ident = tryParseJson(raw);
  } catch (e) {
    console.error('[spotme] Groq vision failed:', e?.status, e?.message || e);
    const status = e?.status;
    if (status === 401) {
      throw new ApiError(500, 'The server is misconfigured — check your Groq API key.');
    }
    if (status === 429) {
      throw new ApiError(503, "I've hit a rate limit. Try again in a minute.");
    }
    if (status === 413 || /too large/i.test(String(e?.message))) {
      throw new ApiError(413, 'Image is too large for the vision model.');
    }
    throw new ApiError(502, "I couldn't reach the vision model. Try again in a moment.");
  }

  if (!ident || typeof ident !== 'object') {
    throw new ApiError(502, "I couldn't read that image clearly. Try another angle?");
  }
  if (ident.machineName === 'UNCLEAR' || !ident.machineName) {
    throw new ApiError(422, "I couldn't tell what that is. Try a clearer photo showing the whole machine.");
  }

  /* ---- ensure fields are arrays even if model missed them ---- */
  ident.primaryMuscles   = Array.isArray(ident.primaryMuscles)   ? ident.primaryMuscles   : [];
  ident.secondaryMuscles = Array.isArray(ident.secondaryMuscles) ? ident.secondaryMuscles : [];
  ident.steps            = Array.isArray(ident.steps)            ? ident.steps            : [];
  ident.proTip     = typeof ident.proTip     === 'string' ? ident.proTip     : '';
  ident.safetyNote = typeof ident.safetyNote === 'string' ? ident.safetyNote : '';
  ident.category   = typeof ident.category   === 'string' ? ident.category   : 'Upper body';

  /* ---- render a human-readable assistant message alongside the JSON ---- */
  const readable = [
    `**${ident.machineName}** — ${ident.category}`,
    '',
    ident.primaryMuscles.length ? `**Primary muscles:** ${ident.primaryMuscles.join(', ')}` : null,
    ident.secondaryMuscles.length ? `**Secondary:** ${ident.secondaryMuscles.join(', ')}` : null,
    '',
    ident.steps.length ? '**How to use it:**' : null,
    ...ident.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    ident.proTip ? `**Pro tip:** ${ident.proTip}` : null,
    ident.safetyNote ? `_Safety:_ ${ident.safetyNote}` : null
  ].filter(Boolean).join('\n');

  const info = stmts.insertMessage.run({
    session_id:      sessionId,
    role:            'assistant',
    content:         readable,
    image_data_url:  null,
    structured_json: JSON.stringify(ident)
  });

  /* ---- tag & re-title the session so History can filter on it ---- */
  const tags = buildTags(ident);
  const title = `${ident.machineName} · ${(ident.primaryMuscles)[0] || ident.category}`;
  stmts.updateSessionMeta.run(title.slice(0, 80), tags, sessionId, req.user.id);

  res.json({
    sessionId,
    messageId: Number(info.lastInsertRowid),
    identification: ident,
    assistantText: readable
  });
}));
