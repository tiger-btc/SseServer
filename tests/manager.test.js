jest.mock('../src/logger', () => ({
  logSSEEvent: jest.fn(),
}))

const { SSEManager, SSEChannel, SSEConnection, formatSSEMessage } = require('../src/sse/manager')
const { logSSEEvent } = require('../src/logger')

describe('SSEConnection', () => {
  test('should create connection with unique id', () => {
    const mockRes = { write: jest.fn() }
    const conn1 = new SSEConnection('test', mockRes)
    const conn2 = new SSEConnection('test', mockRes)
    expect(conn1.id).not.toBe(conn2.id)
  })

  test('should send event data', () => {
    const mockRes = { write: jest.fn().mockReturnValue(true) }
    const conn = new SSEConnection('test', mockRes)
    conn.send('message', { text: 'hello' })
    expect(mockRes.write).toHaveBeenCalledWith('event: message\ndata: {"text":"hello"}\n\n')
  })

  test('should not send if connection is closed', () => {
    const mockRes = { write: jest.fn(), end: jest.fn() }
    const conn = new SSEConnection('test', mockRes)
    conn.close()
    const result = conn.send('message', { text: 'hello' })
    expect(result).toBe(false)
  })

  test('should log when connection closes', () => {
    const mockRes = { write: jest.fn(), end: jest.fn() }
    const conn = new SSEConnection('test', mockRes)

    conn.close()

    expect(logSSEEvent).toHaveBeenCalledWith('connection.closed', expect.objectContaining({
      channel: 'test',
      connectionId: conn.id,
    }))
  })

  test('should treat write backpressure as a live connection', () => {
    const mockRes = { write: jest.fn().mockReturnValue(false) }
    const conn = new SSEConnection('test', mockRes)

    const result = conn.send('message', { text: 'hello' })

    expect(result).toBe(true)
    expect(conn.isAlive).toBe(true)
  })
})

describe('SSEChannel', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('should add and track connections', () => {
    const channel = new SSEChannel('test')
    const mockRes = { write: jest.fn() }

    channel.addConnection(new SSEConnection('test', mockRes))
    expect(channel.getConnectionCount()).toBe(1)
  })

  test('should broadcast to all connections', () => {
    const channel = new SSEChannel('test')
    const mockRes1 = { write: jest.fn().mockReturnValue(true) }
    const mockRes2 = { write: jest.fn().mockReturnValue(true) }

    channel.addConnection(new SSEConnection('test', mockRes1))
    channel.addConnection(new SSEConnection('test', mockRes2))

    channel.broadcast('message', { text: 'hello' })

    expect(mockRes1.write).toHaveBeenCalled()
    expect(mockRes2.write).toHaveBeenCalled()
  })

  test('should emit empty when last connection closes', () => {
    const channel = new SSEChannel('test')
    const mockRes = { write: jest.fn(), end: jest.fn() }
    const conn = new SSEConnection('test', mockRes)

    const handler = jest.fn()
    channel.on('empty', handler)

    channel.addConnection(conn)
    conn.close()

    expect(handler).toHaveBeenCalled()
  })

  test('should replay the latest payload to new subscribers', () => {
    const channel = new SSEChannel('test')
    const existingRes = { write: jest.fn().mockReturnValue(true) }
    const lateRes = { write: jest.fn().mockReturnValue(true) }

    channel.addConnection(new SSEConnection('test', existingRes))
    channel.broadcast('message', { text: 'hello' })

    channel.addConnection(new SSEConnection('test', lateRes))

    expect(lateRes.write).toHaveBeenCalledWith(formatSSEMessage('message', { text: 'hello' }))
  })

  test('should not replace latest payload when sending heartbeat events', () => {
    jest.useFakeTimers()

    const channel = new SSEChannel('test')
    const existingRes = { write: jest.fn().mockReturnValue(true) }
    const lateRes = { write: jest.fn().mockReturnValue(true) }

    channel.addConnection(new SSEConnection('test', existingRes))
    channel.broadcast('message', { text: 'hello' })

    jest.advanceTimersByTime(30000)
    channel.addConnection(new SSEConnection('test', lateRes))

    expect(lateRes.write).toHaveBeenCalledWith(formatSSEMessage('message', { text: 'hello' }))
  })

  test('should keep connection when write returns false', () => {
    const channel = new SSEChannel('test')
    const slowRes = { write: jest.fn().mockReturnValue(false) }

    channel.addConnection(new SSEConnection('test', slowRes))
    const recipients = channel.broadcast('message', { text: 'hello' })

    expect(recipients).toBe(1)
    expect(channel.getConnectionCount()).toBe(1)
  })

  test('should remove connection when write throws', () => {
    const channel = new SSEChannel('test')
    const brokenRes = {
      write: jest.fn(() => {
        throw new Error('socket closed')
      }),
      end: jest.fn(),
    }

    channel.addConnection(new SSEConnection('test', brokenRes))
    const recipients = channel.broadcast('message', { text: 'hello' })

    expect(recipients).toBe(0)
    expect(channel.getConnectionCount()).toBe(0)
  })
})

describe('SSEManager', () => {
  let manager

  beforeEach(() => {
    manager = new SSEManager()
  })

  test('should create channel on first subscription', () => {
    const channel = manager.createOrGetChannel('news')
    expect(channel).toBeInstanceOf(SSEChannel)
    expect(manager.getChannel('news')).toBe(channel)
  })

  test('should return existing channel', () => {
    const channel1 = manager.createOrGetChannel('news')
    const channel2 = manager.createOrGetChannel('news')
    expect(channel1).toBe(channel2)
  })

  test('should delete channel and close connections', () => {
    const mockRes = { write: jest.fn(), end: jest.fn() }
    const channel = manager.createOrGetChannel('news')
    channel.addConnection(new SSEConnection('news', mockRes))

    const result = manager.deleteChannel('news')
    expect(result).toBe(true)
    expect(manager.getChannel('news')).toBeUndefined()
  })

  test('should list all channels', () => {
    manager.createOrGetChannel('news')
    manager.createOrGetChannel('orders')

    const channels = manager.listChannels()
    expect(channels).toHaveLength(2)
    expect(channels.map(c => c.name)).toContain('news')
    expect(channels.map(c => c.name)).toContain('orders')
  })

  test('should count total connections', () => {
    const channel1 = manager.createOrGetChannel('news')
    const channel2 = manager.createOrGetChannel('orders')
    const mockRes = { write: jest.fn() }

    channel1.addConnection(new SSEConnection('news', mockRes))
    channel1.addConnection(new SSEConnection('news', mockRes))
    channel2.addConnection(new SSEConnection('orders', mockRes))

    expect(manager.getTotalConnections()).toBe(3)
  })
})
