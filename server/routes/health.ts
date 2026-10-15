// FreshRoute — Health Check Route
import { Router } from 'express';
import { config, isGoogleMapsConfigured, isOpenRouterConfigured } from '../config.js';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/health', (_req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: 'ok',
    service: 'FreshRoute API Backend',
    version: '1.0.0',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    services: {
      googleMaps: {
        configured: isGoogleMapsConfigured(),
        status: isGoogleMapsConfigured() ? 'ready' : 'missing_api_key',
      },
      googleRoutes: {
        configured: isGoogleMapsConfigured(),
        status: isGoogleMapsConfigured() ? 'ready' : 'fallback_mode',
      },
      openRouter: {
        configured: isOpenRouterConfigured(),
        model: config.openRouterModel,
        status: isOpenRouterConfigured() ? 'ready' : 'fallback_mode',
      },
    },
  });
});
