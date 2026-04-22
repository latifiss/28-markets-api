# Realtime WebSockets

This API exposes a WebSocket endpoint for **real-time updates** when data changes (forex, commodity, crypto, forexInterbank, stocks).

## Endpoint

- **WebSocket URL**: `ws://<host>:<port>/ws`
- **Custom path (optional)**: set `WS_PATH=/ws` (or another path) in your environment.

### Subscribe on connect (query string)

You can pre-subscribe to one or more topics by passing a `topics` query param:

- Example: `ws://localhost:6060/ws?topics=forex,crypto,stocks`

## Topics

Subscribe to broad topics (all updates in a category) or per-entity topics (only updates for a specific item).

- **Forex**
  - Broad: `forex`
  - Per-pair: `forex:<code>` (example: `forex:USDGHS`)
- **Commodity**
  - Broad: `commodity`
  - Per-item: `commodity:<code>`
- **Crypto**
  - Broad: `crypto`
  - Per-coin: `crypto:<SYMBOL>` (example: `crypto:BTC`)
- **Forex Interbank**
  - Broad: `forexInterbank`
  - Per-bank: `forexInterbank:<bankCode>`
  - Per-code: `forexInterbank:code:<code>`
- **Stocks**
  - Broad: `stocks`
  - Per-company: `stocks:<company_id>`
  - Per-ticker: `stocks:ticker:<ticker_symbol>`

## Client messages (subscribe/unsubscribe/ping)

Send JSON messages from the client:

```json
{ "type": "subscribe", "topic": "forex" }
```

```json
{ "type": "unsubscribe", "topic": "forex" }
```

```json
{ "type": "ping" }
```

## Server messages (what you receive)

### Connection acknowledgement

On connect, the server sends:

```json
{
  "event": "connected",
  "path": "/ws",
  "subscribedTopics": ["forex", "crypto"],
  "now": "2026-01-01T00:00:00.000Z"
}
```

### Update envelopes

When data changes, you’ll receive messages shaped like:

```json
{
  "topic": "forex",
  "event": "updated",
  "publishedAt": "2026-01-01T00:00:00.000Z",
  "data": { "...": "payload varies by topic" }
}
```

Notes:
- `topic` matches the broadcast topic (for example `forex` or `forex:USDGHS`).
- `data` is whatever the server published (often the updated Mongo document).

## Browser usage example

```js
const ws = new WebSocket("ws://localhost:6060/ws?topics=forex,crypto");

ws.addEventListener("open", () => {
  console.log("ws connected");
  // Subscribe to a single forex pair after connect:
  ws.send(JSON.stringify({ type: "subscribe", topic: "forex:USDGHS" }));
});

ws.addEventListener("message", (evt) => {
  const msg = JSON.parse(evt.data);
  console.log("ws message", msg);
});

ws.addEventListener("close", () => console.log("ws closed"));
ws.addEventListener("error", (err) => console.error("ws error", err));
```

## Node.js usage example

Install a WS client:

```bash
npm i ws
```

Then:

```js
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:6060/ws?topics=stocks");

ws.on("open", () => {
  console.log("ws connected");
  ws.send(JSON.stringify({ type: "subscribe", topic: "stocks:ticker:GOOG" }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log("ws message", msg.topic, msg.event);
});

ws.on("close", () => console.log("ws closed"));
ws.on("error", (err) => console.error("ws error", err));
```

## Quick testing (manual)

1. Connect a WebSocket client and subscribe to a topic (e.g. `forex`).
2. Call an HTTP endpoint that updates data (e.g. your `PUT`/`POST` update routes).
3. Watch the WS client receive an `event: "updated"` message immediately after the HTTP request succeeds.

