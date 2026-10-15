// FreshRoute — Route Estimation Route
import { Router, Request, Response } from 'express';
import {
  computeRouteEstimate,
  isValidLatLng,
  type LatLng,
} from '../services/googleRoutes.js';

export const routesEstimateRouter = Router();

routesEstimateRouter.post('/routes/estimate', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Support batch requests: { routes: [...] }
    if (body.routes && Array.isArray(body.routes)) {
      if (body.routes.length > 20) {
        res.status(400).json({ error: 'Maximum 20 routes can be evaluated per batch request.' });
        return;
      }

      const results = await Promise.all(
        body.routes.map(async (item: any) => {
          if (!isValidLatLng(item.origin) || !isValidLatLng(item.destination)) {
            return {
              routeId: item.routeId,
              error: 'Invalid coordinates for route',
              isFallback: true,
              source: 'fallback',
              status: 'INVALID_COORDINATES',
              durationHours: item.fallbackHours || 4.0,
              distanceKm: item.fallbackKm || 180,
              durationFormatted: `${item.fallbackHours || 4.0}h`,
            };
          }
          return computeRouteEstimate(
            item.origin,
            item.destination,
            item.routeId,
            item.fallbackHours,
            item.fallbackKm
          );
        })
      );

      res.json({
        count: results.length,
        routes: results,
      });
      return;
    }

    // Single route request
    const { origin, destination, routeId, fallbackHours, fallbackKm } = body;

    if (!origin || !destination) {
      res.status(400).json({
        error: 'Both origin and destination coordinates are required: { lat, lng }',
      });
      return;
    }

    if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
      res.status(400).json({
        error: 'Invalid coordinates. Latitude must be between -90 and 90; longitude between -180 and 180.',
      });
      return;
    }

    const result = await computeRouteEstimate(
      origin as LatLng,
      destination as LatLng,
      routeId,
      fallbackHours,
      fallbackKm
    );

    res.json(result);
  } catch (err: any) {
    console.error('[routesEstimate] Error:', err.message || err);
    res.status(500).json({
      error: 'Failed to compute route estimate.',
      message: err.message,
    });
  }
});
