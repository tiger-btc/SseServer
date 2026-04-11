const EventEmitter = require('events')
const crypto = require('crypto')

const CHANNEL_CLEANUP_DELAY = 60 * 60 * 1000
const HEARTBEAT_INTERVAL = 30000

function formatSSEMessage(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

class SSEConnection extends EventEmitter {
  constructor(channel, res) {
    super()
    this.id = crypto.randomUUID()
    this.channel = channel
    this.res = res
    this.isAlive = true
  }

  send(event, data) {
    return this.sendRaw(formatSSEMessage(event, data))
  }

  sendRaw(payload) {
    if (!this.isAlive) return false
    return this.res.write(payload)
  }

  close() {
    if (!this.isAlive) return
    this.isAlive = false
    this.res.end()
    this.emit('close')
  }
}

class SSEChannel extends EventEmitter {
  constructor(name) {
    super()
    this.name = name
    this.connections = new Map()
    this.latestData = null
    this.latestEvent = 'message'
    this.latestPayload = null
    this.cleanupTimer = null
    this.heartbeatTimer = null
  }

  startCleanupTimer(timeout, onCleanup) {
    this.clearCleanupTimer()
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null
      onCleanup()
    }, timeout)
    this.cleanupTimer.unref()
  }

  clearCleanupTimer() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  addConnection(connection) {
    this.clearCleanupTimer()
    if (this.connections.size === 0) {
      this.startHeartbeat()
    }
    this.connections.set(connection.id, connection)
    connection.on('close', () => this.removeConnection(connection.id))
    if (this.latestPayload !== null) {
      connection.sendRaw(this.latestPayload)
    }
  }

  removeConnection(id) {
    if (!this.connections.delete(id)) {
      return
    }

    if (this.connections.size === 0) {
      this.stopHeartbeat()
      this.emit('empty')
    }
  }

  broadcast(event, data) {
    this.latestData = data
    this.latestEvent = event
    this.latestPayload = formatSSEMessage(event, data)
    return this.broadcastRaw(this.latestPayload)
  }

  broadcastVolatile(event, data) {
    return this.broadcastRaw(formatSSEMessage(event, data))
  }

  broadcastRaw(payload) {
    const deadConnections = []
    for (const conn of this.connections.values()) {
      if (!conn.sendRaw(payload)) {
        deadConnections.push(conn.id)
      }
    }
    for (const id of deadConnections) {
      this.removeConnection(id)
    }
    return this.connections.size
  }

  startHeartbeat() {
    if (this.heartbeatTimer) {
      return
    }

    this.heartbeatTimer = setInterval(() => {
      this.broadcastVolatile('ping', { timestamp: Date.now() })
    }, HEARTBEAT_INTERVAL)
    this.heartbeatTimer.unref()
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  getConnectionCount() {
    return this.connections.size
  }
}

class SSEManager extends EventEmitter {
  constructor() {
    super()
    this.channels = new Map()
  }

  createOrGetChannel(name) {
    let channel = this.channels.get(name)
    if (!channel) {
      channel = new SSEChannel(name)
      channel.on('empty', () => {
        channel.startCleanupTimer(CHANNEL_CLEANUP_DELAY, () => {
          this.channels.delete(name)
        })
      })
      this.channels.set(name, channel)
    } else {
      channel.clearCleanupTimer()
    }
    return channel
  }

  getChannel(name) {
    return this.channels.get(name)
  }

  deleteChannel(name) {
    const channel = this.channels.get(name)
    if (channel) {
      channel.clearCleanupTimer()
      channel.stopHeartbeat()
      for (const conn of channel.connections.values()) {
        conn.close()
      }
      this.channels.delete(name)
      return true
    }
    return false
  }

  listChannels() {
    return Array.from(this.channels.entries()).map(([name, channel]) => ({
      name,
      connections: channel.getConnectionCount(),
    }))
  }

  getTotalConnections() {
    let total = 0
    for (const channel of this.channels.values()) {
      total += channel.getConnectionCount()
    }
    return total
  }
}

module.exports = { SSEManager, SSEChannel, SSEConnection, formatSSEMessage }
