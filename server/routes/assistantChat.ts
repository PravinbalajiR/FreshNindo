// FreshRoute — Operational Decision Assistant Route
import { Router, Request, Response } from 'express';
import { askAssistant } from '../services/openRouter.js';

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
