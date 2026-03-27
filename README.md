# SSE Server

基于 Node.js + Express 的 Server-Sent Events 服务器，支持动态频道和 RESTful API 更新推送。

## 功能特性

- 动态频道管理 - 可创建任意名称的频道，订阅者自动加入
- RESTful API 推送 - 通过 HTTP POST 推送消息到指定频道
- 心跳保活 - 每 30 秒发送 ping 事件，维持连接
- 断线重连支持 - 客户端可自动重连
- 连接统计 - 查看当前频道和连接数

## 快速开始

### 安装

```bash
npm install
```

### 启动

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

访问 `http://localhost:3000` 可查看 Web 测试页面。

### 日志

访问日志默认写入 `logs/access-YYYY-MM-DD.log`，可通过环境变量配置：

- `LOG_DIR`：日志目录
- `ACCESS_LOG_FILE`：日志文件名基准
- `LOG_LEVEL`：日志级别

字段包含：`method`、`path`、`status`、`durationMs`、`ip`、`userAgent`

---

## API 文档

### 1. SSE 订阅端点

#### 订阅频道

```
GET /sse/:channel
```

**参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | 是 | 频道名称，支持任意字符串 |

**响应**

SSE 流格式，持续保持连接。

**事件**

| 事件名 | 说明 |
|--------|------|
| connected | 连接成功时发送，包含频道信息和连接ID |
| message | 普通消息，通过 `/api/publish` 发送 |
| ping | 心跳，每 30 秒发送一次 |

**示例**

```bash
curl -N http://localhost:3000/sse/news
```

```javascript
const es = new EventSource('http://localhost:3000/sse/news');

es.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

es.onmessage = (e) => {
  console.log('Message:', JSON.parse(e.data));
};

es.addEventListener('ping', (e) => {
  console.log('Heartbeat:', JSON.parse(e.data));
};
```

---

### 2. REST API

#### 创建频道

```
POST /api/channels
```

**请求体**

```json
{
  "name": "news"
}
```

**响应**

```json
{
  "success": true,
  "channel": "news",
  "connections": 0
}
```

---

#### 删除频道

```
DELETE /api/channels/:name
```

**参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 频道名称 |

**响应**

```json
{
  "success": true,
  "message": "Channel news deleted"
}
```

---

#### 列出所有频道

```
GET /api/channels
```

**响应**

```json
{
  "channels": [
    { "name": "news", "connections": 3 },
    { "name": "orders", "connections": 2 }
  ]
}
```

---

#### 发布消息

```
POST /api/publish
```

**请求体**

```json
{
  "channel": "news",
  "event": "message",
  "data": {
    "title": "Hello",
    "content": "World"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| channel | string | 是 | 目标频道名称 |
| event | string | 否 | 事件类型，默认 "message" |
| data | any | 是 | 发送的数据 |

**响应**

```json
{
  "success": true,
  "recipients": 5
}
```

**错误响应**

```json
{
  "error": "Channel not found or has no subscribers"
}
```

---

#### 获取统计信息

```
GET /api/stats
```

**响应**

```json
{
  "totalConnections": 5,
  "channels": [
    { "name": "news", "connections": 3 },
    { "name": "orders", "connections": 2 }
  ]
}
```

---

## 使用示例

### curl 命令

```bash
# 订阅频道
curl -N http://localhost:3000/sse/news

# 发布消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{"channel":"news","event":"message","data":{"title":"Hello","content":"World"}}'

# 列出频道
curl http://localhost:3000/api/channels

# 获取统计
curl http://localhost:3000/api/stats
```

### JavaScript 客户端

```javascript
// 订阅频道
const eventSource = new EventSource('http://localhost:3000/sse/news');

eventSource.onopen = () => console.log('Connected to news channel');

eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

eventSource.addEventListener('ping', (event) => {
  console.log('Heartbeat:', JSON.parse(event.data));
};

eventSource.onerror = () => {
  console.log('Connection lost, reconnecting...');
};

// 发布消息
async function publish(channel, data) {
  const res = await fetch('http://localhost:3000/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, event: 'message', data })
  });
  return res.json();
}

publish('news', { title: 'Hello', content: 'World' });
```

### 动态频道示例

```javascript
// 按用户ID订阅
const userChannel = new EventSource('http://localhost:3000/sse/user_123');

// 按主题订阅
const orderChannel = new EventSource('http://localhost:3000/sse/orders');

// 推送消息给指定用户
await publish('user_123', { type: 'notification', message: '您有新消息' });
```

---

## 配置

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| PORT | 3000 | 服务器端口 |
| ALLOWED_ORIGINS | * | 允许的跨域来源，多个用逗号分隔 |

```bash
# 单域名
ALLOWED_ORIGINS=https://example.com npm start

# 多域名
ALLOWED_ORIGINS=https://example.com,https://app.example.com npm start

# 允许所有
ALLOWED_ORIGINS='*' npm start
```

---

## 测试

```bash
npm test
```