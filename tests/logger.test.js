const fs = require('fs')
const path = require('path')

jest.mock('winston', () => {
  const info = jest.fn()
  const createLogger = jest.fn(() => ({ info }))
  const transports = {
    Console: jest.fn(),
  }
  const format = {
    combine: jest.fn(() => jest.fn()),
    timestamp: jest.fn(() => jest.fn()),
    json: jest.fn(() => jest.fn()),
  }

  return { createLogger, transports, format }
})

jest.mock('winston-daily-rotate-file', () => jest.fn())

describe('accessLogger', () => {
  const logsDir = path.join(__dirname, '../logs')

  beforeEach(() => {
    if (fs.existsSync(logsDir)) {
      fs.rmSync(logsDir, { recursive: true, force: true })
    }
    jest.resetModules()
  })

  test('should create log directory and expose middleware', () => {
    const { accessLogger, logSSEEvent, LOG_DIR, SSE_MESSAGE_LOGGING } = require('../src/logger')
    expect(LOG_DIR).toBe(logsDir)
    expect(typeof accessLogger).toBe('function')
    expect(typeof logSSEEvent).toBe('function')
    expect(SSE_MESSAGE_LOGGING).toBe(false)
    expect(fs.existsSync(logsDir)).toBe(true)
  })

  test('should log request details on response end', () => {
    const { logger, accessLogger } = require('../src/logger')
    const req = {
      method: 'GET',
      originalUrl: '/api/channels',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get: jest.fn(() => 'test-agent'),
      url: '/api/channels',
    }
    const res = {
      statusCode: 200,
      end: jest.fn(),
    }
    const next = jest.fn()

    accessLogger(req, res, next)
    res.end('ok')

    expect(next).toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: '/api/channels',
      status: 200,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    }))
  })

  test('should log structured sse events', () => {
    const { logger, logSSEEvent } = require('../src/logger')

    logSSEEvent('connection.opened', {
      channel: 'news',
      connectionId: 'abc',
    })

    expect(logger.info).toHaveBeenCalledWith({
      type: 'sse',
      event: 'connection.opened',
      channel: 'news',
      connectionId: 'abc',
    })
  })

  test('should skip message publish logs by default', () => {
    const { logger, logSSEEvent } = require('../src/logger')

    logSSEEvent('message.published', {
      channel: 'news',
      recipients: 1,
    })

    expect(logger.info).not.toHaveBeenCalled()
  })
})
