const express = require('express')
const { SSEConnection } = require('../sse/manager')

function createSSERoutes(sseManager) {
  const router = express.Router()

  router.get('/:channel', (req, res) => {
    const { channel } = req.params

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (req.socket) {
      req.socket.setNoDelay(true)
      req.socket.setKeepAlive(true)
    }
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders()
    }

    const connection = new SSEConnection(channel, res)
    const sseChannel = sseManager.createOrGetChannel(channel)
    sseChannel.addConnection(connection)

    connection.send('connected', { channel, connectionId: connection.id })

    req.on('close', () => {
      connection.close()
    })
  })

  return router
}

module.exports = { createSSERoutes }
