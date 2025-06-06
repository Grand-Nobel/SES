import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import logger from './utils/logger';
import marketplaceRoutes from './api/v1/marketplace.routes';
import recommendationRoutes from './api/v1/recommendations.routes'; // Added

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3005;

// Middleware
app.use(helmet()); // Basic security headers
app.use(cors()); // Enable CORS - configure appropriately for production
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// HTTP request logger
app.use(pinoHttp({ logger }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'marketplace-service' });
});

// API Routes
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/recommendations', recommendationRoutes); // Added

// Basic root route
app.get('/', (req: Request, res: Response) => {
  res.send('Marketplace Service is running!');
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, stack: err.stack }, 'Unhandled error occurred');
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start server
app.listen(port, () => {
  logger.info(`Marketplace Service listening on port ${port}`);
});

export default app;