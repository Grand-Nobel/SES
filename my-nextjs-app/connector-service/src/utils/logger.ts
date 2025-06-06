import pino from 'pino';
import config from 'config';

const logger = pino({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  transport: config.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger;