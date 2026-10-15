// FreshRoute — Operational Decision Assistant Route
import { Router, Request, Response } from 'express';
import { askAssistant, explainPlain } from '../services/openRouter.js';

export const assistantChatRouter = Router();

assistantChatRouter.post('/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Field "message" is required and must be a non-empty string.' });
      return;
    }

    if (message.trim().length > 1000) {
      res.status(400).json({ error: 'Message exceeds maximum length of 1000 characters.' });
      return;
    }

    const response = await askAssistant(message, context);
    res.json(response);
  } catch (err: any) {
    console.error('[assistantChat] Error:', err.message || err);
    res.status(500).json({
      error: 'Assistant request failed.',
      message: err.message,
    });
  }
});

// Plain-language rewrite of one screen's facts ("Explain more" buttons)
assistantChatRouter.post('/assistant/explain', async (req: Request, res: Response) => {
  const { topic, facts } = req.body ?? {};
  if (typeof topic !== 'string' || !topic.trim() || topic.length > 100) {
    res.status(400).json({ error: 'Field "topic" must be a non-empty string up to 100 characters.' });
    return;
  }
  if (!Array.isArray(facts) || facts.length === 0 || facts.length > 25 || facts.some((f) => typeof f !== 'string' || f.length > 300)) {
    res.status(400).json({ error: 'Field "facts" must be 1–25 strings of up to 300 characters.' });
    return;
  }
  try {
    res.json(await explainPlain(topic.trim(), facts));
  } catch (err: any) {
    console.error('[assistantExplain] Error:', err.message || err);
    res.status(500).json({ error: 'Explain request failed.' });
  }
});
