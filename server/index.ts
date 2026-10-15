// FreshRoute — Express Backend Server
import express from 'express';
import cors from 'cors';
import { config, isGoogleMapsConfigured, isOpenRouterConfigured } from './config.js';
import { healthRouter } from './routes/health.js';
import { routesEstimateRouter } from './routes/routesEstimate.js';
import { assistantChatRouter } from './routes/assistantChat.js';

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));

// Restrict CORS to development frontend or configured origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        config.corsOrigin,
      ];
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Mount API routes
app.use('/api', healthRouter);
app.use('/api', routesEstimateRouter);
app.use('/api', assistantChatRouter);

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[Server Error]', err.message || err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'An unexpected error occurred.',
    });
  }
);

// Start server if not imported as module in tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[FreshRoute Server] Running on http://localhost:${config.port}`);
    console.log(
      `[FreshRoute Server] Google Maps/Routes: ${isGoogleMapsConfigured() ? 'CONFIGURED' : 'NOT CONFIGURED (Fallback active)'}`
    );
    console.log(
      `[FreshRoute Server] OpenRouter Qwen: ${isOpenRouterConfigured() ? `CONFIGURED (${config.openRouterModel})` : 'NOT CONFIGURED (Fallback active)'}`
    );
  });
}

export { app };
