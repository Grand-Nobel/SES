import app from 'app';
import config from 'config';
import logger from 'utils/logger';

const server = app.listen(config.PORT, () => {
  logger.info(`Connector service listening on port ${config.PORT}`);
  logger.info(`Current environment: ${config.NODE_ENV}`);
});

// Graceful shutdown logic
const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
signals.forEach((signal) => {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      // Add any other cleanup here (e.g., close database connections if not handled elsewhere)
      process.exit(0);
    });

    // Force shutdown if server hasn't closed in time
    setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000); // 10 seconds timeout
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
  // Optionally, exit if it's a critical unhandled rejection
  // server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception thrown');
  // It's generally recommended to exit on uncaught exceptions after logging
  server.close(() => process.exit(1));
});