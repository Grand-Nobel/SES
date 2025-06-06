import pino from 'pino';

// Determine if running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Define a custom logger interface that extends pino.Logger
interface CustomLogger extends pino.Logger {
  withContext: (context: Record<string, unknown>) => CustomLogger; // Changed any to unknown
}

const createLogger = (): CustomLogger => {
  let baseLogger: pino.Logger;

  if (isBrowser) {
    // For client-side, pino can be configured with browser options
    baseLogger = pino({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      browser: {
        asObject: true,
      },
    });
  } else {
    // For server-side, use pino with JSON output
    baseLogger = pino({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  // Extend the base logger with a `withContext` method
  const customLogger = baseLogger as CustomLogger;
  customLogger.withContext = function (context: Record<string, unknown>): CustomLogger {
    return this.child(context) as CustomLogger;
  };

  return customLogger;
};

const logger = createLogger();
export default logger;

/**
 * Placeholder for PrivacyLogger functionality.
 * This can be integrated with the main pino logger or remain separate
 * depending on specific privacy logging requirements.
 */
export const PrivacyLogger = () => ({
  log: async (eventName: string, payload: Record<string, unknown>) => { // Changed any to Record<string, unknown>
    // Use the main logger instance or a dedicated privacy-focused one
    logger.info({ eventName, privacyPayload: payload, type: 'privacy' }, `Privacy Event: ${eventName}`);
    // In a real application, this might have different transport or redaction rules.
  },
  maskPersonalData: async (data: Record<string, unknown>) => { // Changed any to Record<string, unknown>
    // Implement actual data masking logic here
    logger.debug({ dataToMask: data, type: 'privacy' }, "Masking personal data (placeholder)");
    // Example: return a new object with sensitive fields masked
    return { ...data, sensitiveField: '***MASKED***' }; // Placeholder
  }
});
