const express = require('express');
const cors = require('cors');
const path = require('path');
const { SSEManager } = require('./sse/manager');
const { createSSERoutes } = require('./routes/sse');
const { createAPIRoutes } = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.static(path.join(__dirname, '../www'), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
}));

app.disable('x-powered-by');

const sseManager = new SSEManager();

app.use('/sse', createSSERoutes(sseManager));
app.use('/api', createAPIRoutes(sseManager));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../www/index.html'));
});

const server = app.listen(PORT, () => {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  console.log(`SSE Server running on http://localhost:${PORT}`);
  console.log(`CORS allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

module.exports = { app, sseManager, server };