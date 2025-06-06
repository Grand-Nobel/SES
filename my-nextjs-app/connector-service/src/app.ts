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
import weaviate from 'weaviate-client';
import Redis from 'ioredis';

// Initialize Prometheus metrics collection
collectDefaultMetrics(); // Collects default Node.js and process metrics

// Weaviate Client Initialization
// Ensure WEAVIATE_URL (e.g., "https://your-instance.weaviate.network" using the REST endpoint)
// and WEAVIATE_API_KEY are set in the environment.
// OPENAI_API_KEY is optional, for modules that use OpenAI.

let weaviateClientInstance: import('weaviate-client').WeaviateClient | null = null;

async function getWeaviateClient(): Promise<import('weaviate-client').WeaviateClient> {
  if (weaviateClientInstance) {
    return weaviateClientInstance;
  }

  // Use WEAVIATE_REST_ENDPOINT for the Weaviate URL
  const weaviateUrl = `https://${process.env.WEAVIATE_REST_ENDPOINT}`; 
  const apiKey = process.env.WEAVIATE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!process.env.WEAVIATE_REST_ENDPOINT) {
    logger.error('WEAVIATE_REST_ENDPOINT environment variable is not set for Weaviate Cloud URL.');
    // Attempt local connection as a fallback if REST_ENDPOINT is not set
  }
  
  if (process.env.WEAVIATE_REST_ENDPOINT && weaviateUrl) {
    const clientConfig: { authCredentials?: import('weaviate-client').ApiKey, headers?: Record<string, string> } = {};
    if (apiKey) {
      clientConfig.authCredentials = new weaviate.ApiKey(apiKey);
    }
    if (openaiApiKey) {
      clientConfig.headers = { ...clientConfig.headers, 'X-OpenAI-Api-Key': openaiApiKey };
    }

    try {
      logger.info(`Attempting to connect to Weaviate Cloud at ${weaviateUrl}`);
      weaviateClientInstance = await weaviate.connectToWeaviateCloud(weaviateUrl, clientConfig);
      logger.info('Successfully connected to Weaviate Cloud.');
      return weaviateClientInstance;
    } catch (error) {
      logger.error({ err: error, weaviateUrl }, 'Failed to connect to Weaviate Cloud. Will attempt local connection if configured.');
    }
  }

  // Fallback or primary connection for local development
  const localHost = process.env.WEAVIATE_LOCAL_HOST || 'localhost'; // Default to 'localhost'
  const localRestPort = parseInt(process.env.WEAVIATE_LOCAL_REST_PORT || '8080', 10);
  const localGrpcPort = parseInt(process.env.WEAVIATE_LOCAL_GRPC_PORT || '50051', 10);
  const localScheme = (process.env.WEAVIATE_LOCAL_SCHEME || 'http').toLowerCase() as 'http' | 'https';
  
  logger.info(`Attempting to connect to local Weaviate at ${localScheme}://${localHost}:${localRestPort} (gRPC: ${localGrpcPort})`);
  try {
    const localClientConfig: { headers?: Record<string, string> } = {};
    // For local connection, API key might be passed via headers if auth is enabled.
    // The v3 connectToLocal doesn't have a direct authCredentials field like connectToWeaviateCloud.
    if (apiKey) {
      localClientConfig.headers = { ...localClientConfig.headers, 'X-Api-Key': apiKey }; // Example, actual header might vary
    }
    if (openaiApiKey && localClientConfig.headers) {
        localClientConfig.headers['X-OpenAI-Api-Key'] = openaiApiKey;
    } else if (openaiApiKey) {
        localClientConfig.headers = { 'X-OpenAI-Api-Key': openaiApiKey };
    }

    weaviateClientInstance = await weaviate.connectToLocal({
      host: localHost,
      port: localRestPort,
      grpcPort: localGrpcPort,
      // scheme: localScheme, // Removed as it causes TS error
      // httpSecure: localSchemeIsHttps, // Also caused error previously
      // grpcSecure: localSchemeIsHttps, // Also caused error previously
      headers: localClientConfig.headers,
    });
    logger.info('Successfully connected to local Weaviate instance.');
    return weaviateClientInstance;
  } catch (localError) {
    logger.error({ err: localError }, 'Failed to connect to local Weaviate instance.');
    throw localError; 
  }
}

// Initialize Redis client
const redisClient = new Redis({
  host: (process.env.REDIS_PUBLIC_ENDPOINT || 'localhost:6379').split(':')[0], // Replace with your Redis instance endpoint
  port: parseInt((process.env.REDIS_PUBLIC_ENDPOINT || 'localhost:6379').split(':')[1] || '6379'),
  db: 0, // Use the default database (0) or specify another one
});

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
