import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, module }) => {
  const moduleText = module ? `[${module}] ` : '';
  return `${timestamp} ${level}: ${moduleText}${message}`;
});

export function createLogger(module = 'app') {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
    defaultMeta: { module },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    ]
  });
}