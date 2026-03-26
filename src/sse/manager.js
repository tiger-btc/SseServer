const EventEmitter = require('events');
const crypto = require('crypto');

class SSEConnection extends EventEmitter {
  constructor(channel, res) {
    super();
    this.id = crypto.randomUUID();
    this.channel = channel;
    this.res = res;
    this.isAlive = true;
  }

  send(event, data) {
    if (!this.isAlive) return false;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    return this.res.write(payload);
  }

  close() {
    this.isAlive = false;
    this.res.end();
    this.emit('close');
  }
}

class SSEChannel extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.connections = new Map();
    this.latestData = null;
    this.latestEvent = 'message';
    this.cleanupTimer = null;
  }

  startCleanupTimer(timeout, onCleanup) {
    this.clearCleanupTimer();
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      onCleanup();
    }, timeout);
  }

  clearCleanupTimer() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  addConnection(connection) {
    this.clearCleanupTimer();
    this.connections.set(connection.id, connection);
    connection.on('close', () => this.removeConnection(connection.id));
    if (this.latestData !== null) {
      connection.send(this.latestEvent, this.latestData);
    }
  }

  removeConnection(id) {
    this.connections.delete(id);
    if (this.connections.size === 0) {
      this.emit('empty');
    }
  }

  broadcast(event, data) {
    this.latestData = data;
    this.latestEvent = event;
    const deadConnections = [];
    this.connections.forEach((conn) => {
      if (!conn.send(event, data)) {
        deadConnections.push(conn.id);
      }
    });
    deadConnections.forEach((id) => this.removeConnection(id));
  }

  getConnectionCount() {
    return this.connections.size;
  }
}

class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.channels = new Map();
  }

  createOrGetChannel(name) {
    if (!this.channels.has(name)) {
      const channel = new SSEChannel(name);
      const CHANNEL_CLEANUP_DELAY = 60 * 60 * 1000;

      channel.on('empty', () => {
        channel.startCleanupTimer(CHANNEL_CLEANUP_DELAY, () => {
          this.channels.delete(name);
        });
      });

      this.channels.set(name, channel);
    } else {
      const channel = this.channels.get(name);
      channel.clearCleanupTimer();
    }
    return this.channels.get(name);
  }

  getChannel(name) {
    return this.channels.get(name);
  }

  deleteChannel(name) {
    const channel = this.channels.get(name);
    if (channel) {
      channel.clearCleanupTimer();
      channel.connections.forEach((conn) => conn.close());
      this.channels.delete(name);
      return true;
    }
    return false;
  }

  listChannels() {
    return Array.from(this.channels.keys()).map((name) => ({
      name,
      connections: this.channels.get(name).getConnectionCount(),
    }));
  }

  getTotalConnections() {
    let total = 0;
    this.channels.forEach((channel) => {
      total += channel.getConnectionCount();
    });
    return total;
  }
}

module.exports = { SSEManager, SSEChannel, SSEConnection };