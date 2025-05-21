import pino from 'pino';

// Determine if running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Simplified logger for diagnosis
const createLogger = () => {
  if (isBrowser) {
    // For client-side, pino can be configured with browser options
    return pino({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      browser: {
        asObject: true,
      },
    });
  } else {
    // For server-side (including Server Components), completely bypass pino for diagnosis.
    // Use console directly.
    const consoleLogger = {
      info: (...args: any[]) => console.log('[SSR-INFO]', ...args),
      warn: (...args: any[]) => console.warn('[SSR-WARN]', ...args),
      error: (...args: any[]) => console.error('[SSR-ERROR]', ...args),
      debug: (...args: any[]) => console.debug('[SSR-DEBUG]', ...args),
      fatal: (...args: any[]) => console.error('[SSR-FATAL]', ...args),
      trace: (...args: any[]) => console.trace('[SSR-TRACE]', ...args),
      silent: () => {},
      child: () => consoleLogger, // Return self for basic child compatibility
    };
    return consoleLogger as unknown as pino.Logger; // Cast to satisfy pino.Logger type expectation
  }
};

const logger = createLogger();
export default logger;

/**
 * Placeholder for PrivacyLogger functionality.
 * This can be integrated with the main pino logger or remain separate
 * depending on specific privacy logging requirements.
 */
export const PrivacyLogger = () => ({
  log: async (eventName: string, payload: any) => {
    // Use the main logger instance or a dedicated privacy-focused one
    logger.info({ eventName, privacyPayload: payload, type: 'privacy' }, `Privacy Event: ${eventName}`);
    // In a real application, this might have different transport or redaction rules.
  },
  maskPersonalData: async (data: any) => {
    // Implement actual data masking logic here
    logger.debug({ dataToMask: data, type: 'privacy' }, "Masking personal data (placeholder)");
    // Example: return a new object with sensitive fields masked
    return { ...data, sensitiveField: '***MASKED***' }; // Placeholder
  }
});
