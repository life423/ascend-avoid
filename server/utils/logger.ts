enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

const levelOrder: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] <= levelOrder[currentLevel];
}

function prefix(): string {
  return `[${new Date().toISOString()}]`;
}

const logger = {
  error: (...args: unknown[]) => {
    if (shouldLog(LogLevel.ERROR)) console.error(prefix(), ...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog(LogLevel.WARN)) console.warn(prefix(), ...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog(LogLevel.INFO)) console.log(prefix(), ...args);
  },
  debug: (...args: unknown[]) => {
    if (shouldLog(LogLevel.DEBUG)) console.debug(prefix(), ...args);
  }
};

export default logger;
