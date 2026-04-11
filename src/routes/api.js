const express = require('express')

function createAPIRoutes(sseManager) {
  const router = express.Router()

  router.post('/channels', (req, res) => {
    const { name } = req.body
    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' })
    }
    const channel = sseManager.createOrGetChannel(name)
    res.json({ success: true, channel: name, connections: channel.getConnectionCount() })
  })

  router.delete('/channels/:name', (req, res) => {
    const { name } = req.params
    const deleted = sseManager.deleteChannel(name)
    if (deleted) {
      res.json({ success: true, message: `Channel ${name} deleted` })
    } else {
      res.status(404).json({ error: 'Channel not found' })
    }
  })

  router.get('/channels', (req, res) => {
    res.json({ channels: sseManager.listChannels() })
  })

  router.post('/publish', (req, res) => {
    const { channel, event = 'message', data } = req.body
    if (!channel || data === undefined) {
      return res.status(400).json({ error: 'channel and data are required' })
    }

    const sseChannel = sseManager.getChannel(channel)
    if (!sseChannel || sseChannel.getConnectionCount() === 0) {
      return res.status(404).json({ error: 'Channel not found or has no subscribers' })
    }

    const recipients = sseChannel.broadcast(event, data)
    res.json({ success: true, recipients })
  })

  router.get('/stats', (req, res) => {
    res.json({
      totalConnections: sseManager.getTotalConnections(),
      channels: sseManager.listChannels(),
    })
  })

  return router
}

module.exports = { createAPIRoutes }
