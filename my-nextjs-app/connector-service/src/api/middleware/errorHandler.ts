import { Request, Response, NextFunction } from 'express';
import logger from 'utils/logger';
import config from 'config';

interface HttpError extends Error {
  status?: number;
  isOperational?: boolean;
}

const errorHandler = (err: HttpError, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: err.message,
    status: err.status || 500,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    isOperational: err.isOperational,
  });

  const statusCode = err.status || 500;
  const responseError: { message: string; stack?: string } = {
    message: err.isOperational ? err.message : 'An unexpected error occurred.',
  };

  if (config.NODE_ENV === 'development' && err.stack) {
    responseError.stack = err.stack;
  }

  res.status(statusCode).json(responseError);
};

export default errorHandler;