const express = require('express');
const { SSEConnection } = require('../sse/manager');

function createSSERoutes(sseManager) {
  const router = express.Router();

  router.get('/:channel', (req, res) => {
    const { channel } = req.params;

    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['*'];
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const connection = new SSEConnection(channel, res);
    const sseChannel = sseManager.createOrGetChannel(channel);
    sseChannel.addConnection(connection);

    connection.send('connected', { channel, connectionId: connection.id });

    const heartbeat = setInterval(() => {
      if (!connection.send('ping', { timestamp: Date.now() })) {
        clearInterval(heartbeat);
        connection.close();
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      connection.close();
    });
  });

  return router;
}

module.exports = { createSSERoutes };