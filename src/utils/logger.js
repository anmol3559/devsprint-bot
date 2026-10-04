// src/utils/logger.js
/**
 * Structured JSON logging for the DevSprint AI Pipeline.
 * Logs are machine-readable and include timestamps, severity levels,
 * and metadata for monitoring and debugging.
 */

const LEVELS = ['info', 'warn', 'error', 'debug'];

function createLog(level, message, metadata = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: 'hermes-agent',
    message,
    ...metadata
  });
}

const logger = {
  info: (msg, meta = {}) => console.log(createLog('info', msg, meta)),
  warn: (msg, meta = {}) => console.log(createLog('warn', msg, meta)),
  error: (msg, meta = {}) => console.log(createLog('error', msg, meta)),
  debug: (msg, meta = {}) => process.env.LOG_LEVEL === 'debug' ? console.log(createLog('debug', msg, meta)) : null,
};

/**
 * Log a post event with consistent context
 */
logger.postEvent = (eventType, postId, metadata = {}) => {
  logger.info(`Post ${eventType}`, {
    postId: postId?.toString() || 'unknown',
    eventType,
    ...metadata
  });
};

/**
 * Log an API call (Gemini, Instagram, Cloudinary, etc.)
 */
logger.apiCall = (service, status, latencyMs, metadata = {}) => {
  const level = status === 'success' ? 'info' : status === 'error' ? 'error' : 'warn';
  logger[level](`API call to ${service}`, {
    service,
    status,
    latencyMs,
    ...metadata
  });
};

module.exports = logger;
