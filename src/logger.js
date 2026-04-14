const fs = require('fs')
const path = require('path')
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs')
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const ACCESS_LOG_FILE = process.env.ACCESS_LOG_FILE || 'access.log'
const ACCESS_LOG_PATH = path.join(LOG_DIR, ACCESS_LOG_FILE)
const SSE_MESSAGE_LOGGING = process.env.SSE_MESSAGE_LOGGING === 'true'

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: ACCESS_LOG_FILE.replace(/\.log$/, '') + '-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true,
    }),
  ],
})

function accessLogger(req, res, next) {
  const start = process.hrtime.bigint()
  const originalEnd = res.end

  res.end = function patchedEnd(...args) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    logger.info({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      ip: req.ip || req.socket.remoteAddress || '',
      userAgent: req.get('user-agent') || '',
    })

    res.end = originalEnd
    return originalEnd.apply(this, args)
  }

  next()
}

function logSSEEvent(event, details) {
  if (event === 'message.published' && !SSE_MESSAGE_LOGGING) {
    return
  }

  logger.info({
    type: 'sse',
    event,
    ...details,
  })
}

module.exports = { logger, accessLogger, logSSEEvent, LOG_DIR, ACCESS_LOG_PATH, SSE_MESSAGE_LOGGING }
