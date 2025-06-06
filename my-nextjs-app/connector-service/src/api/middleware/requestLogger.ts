import { Request, Response, NextFunction } from 'express';
import logger from 'utils/logger';

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3); // milliseconds

    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: parseFloat(duration),
      ip: req.ip,
      user_agent: req.get('user-agent'),
    }, `HTTP ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

export default requestLogger;