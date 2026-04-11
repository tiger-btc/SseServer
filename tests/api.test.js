const { createAPIRoutes } = require('../src/routes/api')
const { SSEManager, SSEConnection } = require('../src/sse/manager')

function getRouteHandler(router, method, path) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method])
  return layer.route.stack[0].handle
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

describe('API routes', () => {
  let manager
  let router

  beforeEach(() => {
    manager = new SSEManager()
    router = createAPIRoutes(manager)
  })

  test('should reject publish when channel does not exist', () => {
    const handler = getRouteHandler(router, 'post', '/publish')
    const req = {
      body: {
        channel: 'missing',
        data: { text: 'hello' },
      },
    }
    const res = createResponse()

    handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Channel not found or has no subscribers' })
  })

  test('should reject publish when channel has no subscribers', () => {
    const handler = getRouteHandler(router, 'post', '/publish')
    manager.createOrGetChannel('news')
    const req = {
      body: {
        channel: 'news',
        data: { text: 'hello' },
      },
    }
    const res = createResponse()

    handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'Channel not found or has no subscribers' })
  })

  test('should publish to active subscribers without creating a new channel', () => {
    const handler = getRouteHandler(router, 'post', '/publish')
    const channel = manager.createOrGetChannel('news')
    const mockRes = { write: jest.fn().mockReturnValue(true) }
    channel.addConnection(new SSEConnection('news', mockRes))

    const req = {
      body: {
        channel: 'news',
        event: 'message',
        data: { text: 'hello' },
      },
    }
    const res = createResponse()

    handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ success: true, recipients: 1 })
    expect(mockRes.write).toHaveBeenCalled()
    expect(manager.listChannels()).toHaveLength(1)
  })
})
