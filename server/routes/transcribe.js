/*
 * SpotMe — audio transcription route
 * POST /api/transcribe
 *   multipart/form-data field: audio  (webm / mp4 / ogg blob)
 *   returns: { text: string }
 */

import express from 'express';
import multer from 'multer';
import Groq from 'groq-sdk';
import { ApiError, requireAuth, handler } from './_shared.js';

export const transcribeRoutes = express.Router();

const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

transcribeRoutes.post(
  '/',
  requireAuth,
  upload.single('audio'),
  handler(async (req, res) => {
    if (!req.file || !req.file.buffer.length) throw new ApiError(400, 'No audio received.');

    const mime = req.file.mimetype || 'audio/webm';
    const ext  = mime.includes('mp4') ? 'm4a'
               : mime.includes('ogg') ? 'ogg'
               : 'webm';

    // Node 18+ has File globally; wrap the buffer so Groq SDK streams it correctly.
    const audioFile = new File([req.file.buffer], `rec.${ext}`, { type: mime });

    let result;
    try {
      result = await groq.audio.transcriptions.create({
        file:            audioFile,
        model:           'whisper-large-v3-turbo',
        response_format: 'json',
        language:        'en'
      });
    } catch (e) {
      console.error('[spotme] Whisper error:', e?.status, e?.message || e);
      const s = e?.status;
      if (s === 401) throw new ApiError(500, 'Server misconfigured — check GROQ_API_KEY.');
      if (s === 429) throw new ApiError(503, 'Rate limited. Try again in a moment.');
      if (s === 413) throw new ApiError(413, 'Recording too large for transcription.');
      throw new ApiError(502, 'Transcription failed. Try again.');
    }

    res.json({ text: result.text || '' });
  })
);
