import express, { Express, Request, Response, NextFunction, Router } from 'express';
import pino from 'pino';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { register, Counter, Gauge, Histogram, Summary } from 'prom-client';

// Re-export prom-client metrics for convenience if SDK users need them directly
export { Counter, Gauge, Histogram, Summary, register as prometheusRegister };

export interface ConnectorConfig {
  port: number;
  serviceName: string;
  serviceVersion: string;
  // Add other common configurations like API keys, base URLs, etc.
  // These might be loaded from environment variables or a config file.
  [key: string]: any; // Allow for custom config properties
}

export interface ConnectorContext {
  logger: pino.Logger;
  httpClient: AxiosInstance;
  config: ConnectorConfig;
  // Potentially add tenant context or other shared utilities
}

export type ConnectorRouteHandler = (req: Request, res: Response, next: NextFunction, context: ConnectorContext) => void | Promise<void>;

export interface ConnectorRoute {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';
  handler: ConnectorRouteHandler;
  // Add middleware specific to this route if needed
  // middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}

export interface ConnectorDefinition {
  name: string;
  version: string;
  description?: string;
  routes?: ConnectorRoute[]; // API routes provided by the connector
  onStartup?: (context: ConnectorContext) => Promise<void>; // Logic to run on service startup
  onShutdown?: (context: ConnectorContext) => Promise<void>; // Logic for graceful shutdown
  // Add other lifecycle hooks or metadata as needed
}

/**
 * Creates and starts a new connector service.
 * @param definition The connector definition object.
 * @param config The runtime configuration for the connector.
 */
export function createConnector(definition: ConnectorDefinition, config: ConnectorConfig): Express {
  const app: Express = express();
  const loggerInstance = pino({
    name: `${definition.name}-v${definition.version}`,
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  });

  const httpClientInstance = axios.create({
    timeout: config.timeout || 15000, // Default timeout
  });

  const context: ConnectorContext = {
    logger: loggerInstance,
    httpClient: httpClientInstance,
    config,
  };

  // Standard middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Could add CORS, Helmet, etc., here or let connector define them

  // Health check endpoint for the connector itself
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'UP', 
      serviceName: definition.name, 
      version: definition.version,
      sdkVersion: "@seed-os/connector-sdk@0.1.0" // Match SDK version in package.json
    });
  });

  // Metrics endpoint (if prom-client is used and SDK provides this)
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (ex: any) {
      context.logger.error({ err: ex }, 'Error serving connector metrics');
      res.status(500).end(ex.message);
    }
  });
  
  // Register connector-defined routes
  if (definition.routes) {
    const connectorRouter = Router();
    definition.routes.forEach(route => {
      // Wrap handler to pass context
      const wrappedHandler = (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(route.handler(req, res, next, context))
          .catch(err => {
            context.logger.error({ err, routePath: route.path, method: route.method }, 'Error in connector route handler');
            // Ensure error is passed to Express error handler or a default response is sent
            if (!res.headersSent) {
              res.status(500).json({ error: 'Internal connector error' });
            } else {
              next(err); // If headers already sent, pass to default Express error handler
            }
          });
      };
      
      // Apply route-specific middleware if any
      // if (route.middleware && route.middleware.length > 0) {
      //   connectorRouter[route.method](route.path, ...route.middleware, wrappedHandler);
      // } else {
      connectorRouter[route.method](route.path, wrappedHandler);
      // }
      context.logger.info(`Route registered: ${route.method.toUpperCase()} ${route.path}`);
    });
    app.use('/', connectorRouter); // Mount under root, or a configurable base path
  }

  // Global error handler for the connector service
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    context.logger.error({ err, stack: err.stack, url: req.originalUrl }, 'Unhandled error in connector service');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    } else {
      next(err);
    }
  });

  const server = app.listen(config.port, async () => {
    context.logger.info(`${definition.name} v${definition.version} (SDK @seed-os/connector-sdk@0.1.0) listening on port ${config.port}`);
    if (definition.onStartup) {
      try {
        await definition.onStartup(context);
        context.logger.info('Connector onStartup hook completed successfully.');
      } catch (error) {
        context.logger.error({ error }, 'Error during connector onStartup hook.');
        // Optionally, shut down the server if startup fails critically
        // server.close(() => process.exit(1));
      }
    }
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    context.logger.info(`Received ${signal}. Shutting down ${definition.name} gracefully...`);
    if (definition.onShutdown) {
      try {
        await definition.onShutdown(context);
        context.logger.info('Connector onShutdown hook completed successfully.');
      } catch (error) {
        context.logger.error({ error }, 'Error during connector onShutdown hook.');
      }
    }
    server.close(() => {
      context.logger.info(`${definition.name} has been shut down.`);
      process.exit(0);
    });
    
    // Force shutdown after a timeout
    setTimeout(() => {
        context.logger.warn('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app; // Return the express app instance, though server is already started
}

// Export other utilities or types that connectors might need
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse };