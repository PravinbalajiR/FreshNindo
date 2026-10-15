// FreshRoute — Server Environment Configuration
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export function isGoogleMapsConfigured(): boolean {
  return !!config.googleMapsApiKey && config.googleMapsApiKey.trim().length > 0;
}

export function isOpenRouterConfigured(): boolean {
  return !!config.openRouterApiKey && config.openRouterApiKey.trim().length > 0;
}
