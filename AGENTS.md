# AGENTS.md - Agent Coding Guidelines for SSE Server

## Project Overview

This is a Node.js + Express Server-Sent Events (SSE) server with:
- Dynamic channel management
- RESTful API for publishing messages
- Heartbeat/ping for connection keep-alive
- CORS support

## Build, Lint, and Test Commands

### Running the Server
```bash
npm start          # Start production server (PORT=3000)
PORT=8000 npm start  # Custom port
npm run dev        # Development with auto-reload (--watch)
```

### Running Tests
```bash
npm test           # Run all tests
npx jest           # Run all tests (alternative)
npx jest --watch   # Watch mode
npx jest tests/manager.test.js         # Run single test file
npx jest -t "should create channel"    # Run single test by name
npx jest --coverage                     # With coverage report
```

## Code Style Guidelines

### General Principles
- Use **CommonJS** (require/module.exports) - this project does NOT use ES modules
- Use **2-space indentation**
- Use **single quotes** for strings unless escaping is needed
- Use **camelCase** for variables and functions
- Use **PascalCase** for class names
- **No semicolons** at end of statements
- Use **const** by default, **let** when reassignment is needed

### Imports
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');
const { SSEManager } = require('./sse/manager');
```

- Group external imports first, then internal
- Use destructuring for multiple exports from same module
- One require per line (no consolidated require statements)

### File Structure
```
src/
  index.js          # Main entry point, Express app setup
  sse/
    manager.js      # SSEConnection, SSEChannel, SSEManager classes
  routes/
    sse.js          # SSE endpoint handlers (/sse/:channel)
    api.js          # REST API handlers (/api/*)
tests/
  *.test.js         # Jest test files
www/
  index.html        # Static web UI
```

### Naming Conventions
- **Files**: kebab-case (e.g., `sse-manager.js`)
- **Classes**: PascalCase (e.g., `SSEManager`)
- **Functions/variables**: camelCase (e.g., `createOrGetChannel`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_PORT`)
- **Event names**: camelCase (e.g., `'connected'`, `'message'`)

### Error Handling
- Use appropriate HTTP status codes:
  - `200` - Success
  - `400` - Bad request (missing parameters)
  - `404` - Not found (channel doesn't exist)
  - `500` - Server error
- Return JSON error responses: `{ error: 'human readable message' }`
- Validate input early, return 400 for missing required fields

### Response Format
```javascript
// Success
res.json({ success: true, channel: 'name', connections: 0 });

// Error
res.status(400).json({ error: 'Channel name is required' });

// List response
res.json({ channels: [{ name: 'news', connections: 3 }] });
```

### Types
- This project uses **plain JavaScript** (no TypeScript)
- Use JSDoc comments for complex types if needed
- Document expected data shapes in comments

### Security Best Practices
- Use `express.json({ limit: '10mb' })` to limit request body size
- Set security headers (X-Content-Type-Options, X-Frame-Options)
- Validate CORS origins properly
- Disable x-powered-by header: `app.disable('x-powered-by')`

### Testing Guidelines
- Test file naming: `*.test.js`
- Use Jest (already configured in package.json)
- Group tests with `describe()` blocks
- Use meaningful test names: `should create channel on first subscription`
- Use `jest.fn()` for mocks
- Clean up in `afterEach` or use `beforeEach` to create fresh instances

### SSE Protocol
- Content-Type: `text/event-stream`
- Cache-Control: `no-cache`
- Connection: `keep-alive`
- Format: `event: <eventname>\ndata: <JSON>\n\n`
- Send heartbeat every 30 seconds

### Adding New Features

1. **New API endpoint**: Add route in `src/routes/api.js`
2. **New SSE handler**: Add route in `src/routes/sse.js`
3. **New SSE class**: Add in `src/sse/manager.js`
4. **New test**: Add in `tests/` directory

### Common Patterns

#### Creating a new route handler:
```javascript
function createAPIRoutes(sseManager) {
  const router = express.Router();
  
  router.get('/endpoint', (req, res) => {
    // Validate input
    // Perform operation
    // Return response
  });
  
  return router;
}
```

#### Creating a channel:
```javascript
const channel = sseManager.createOrGetChannel(channelName);
channel.broadcast(event, data);
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| ALLOWED_ORIGINS | * | Comma-separated CORS origins |

### Debugging
- Check server logs for startup messages
- Use `curl -N http://localhost:3000/sse/channel` to test SSE
- Use browser DevTools Network tab to monitor SSE connections
- Jest `--verbose` flag for detailed test output