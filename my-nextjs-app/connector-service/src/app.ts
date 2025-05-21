import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from 'config';
import logger from 'utils/logger';
import requestLogger from 'api/middleware/requestLogger';
import errorHandler from 'api/middleware/errorHandler';
import tenantAuth from 'api/middleware/tenantAuth'; // Placeholder tenant auth
import v1ApiRoutes from 'api/v1'; // Aggregated v1 routes
import { HealthCheckResponse } from 'types/api.types';
import { register as prometheusRegister, collectDefaultMetrics } from 'prom-client';

// Initialize Prometheus metrics collection
collectDefaultMetrics(); // Collects default Node.js and process metrics

const app: Express = express();

// --- Core Middleware ---
// Enable CORS - configure origins as needed for production
app.use(cors()); // Consider more restrictive options: app.use(cors({ origin: 'https://yourfrontend.com' }));
// Security headers
app.use(helmet());
// Body parsing
app.use(express.json({ limit: '10mb' })); // Adjust limit as needed
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Custom Middleware ---
// Request logging (before tenantAuth to log all incoming)
app.use(requestLogger);
// Tenant authentication/identification (placeholder)
app.use(tenantAuth); // This will add req.tenantId if header is present

// --- API Routes ---
app.use('/api/v1', v1ApiRoutes);

// --- Health Check Endpoint ---
app.get('/health', (req: Request, res: Response<HealthCheckResponse>) => {
  const healthCheckResponse: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Connector service is healthy.',
    // TODO: Add checks for critical dependencies like Supabase, Vault
    // dependencies: [
    //   { name: 'Supabase', status: 'ok' }, // Example
    // ],
  };
  res.status(200).json(healthCheckResponse);
});

// --- Metrics Endpoint ---
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', prometheusRegister.contentType);
    res.end(await prometheusRegister.metrics());
  } catch (ex) {
    logger.error({ err: ex }, 'Error serving metrics');
    res.status(500).end(ex);
  }
});

// --- Not Found Handler (after all routes) ---
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ message: 'Resource not found on this server.' });
});

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

export default app;