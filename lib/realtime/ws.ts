import type http from 'http';
import { WebSocketServer, type WebSocket } from 'ws';

type Topic = string;

type ClientState = {
  topics: Set<Topic>;
};

type RealtimeMessage =
  | { type: 'ping' }
  | { type: 'subscribe'; topic: Topic }
  | { type: 'unsubscribe'; topic: Topic };

type BroadcastEnvelope = {
  topic: Topic;
  event: string;
  publishedAt: string;
  data: unknown;
};

let wss: WebSocketServer | null = null;
const clientState = new WeakMap<WebSocket, ClientState>();

export function initRealtimeWebsocketServer(server: http.Server, opts?: { path?: string; allowedOrigins?: string[] }) {
  if (wss) return wss;

  const path = opts?.path ?? '/ws';
  const allowedOrigins = opts?.allowedOrigins ?? [];

  wss = new WebSocketServer({
    server,
    path,
    verifyClient: (info: any, done: (res: boolean, code?: number, name?: string) => void) => {
      // If you don't set Origin in a WS client (e.g. some backends), allow it.
      const origin = info.origin;
      if (!origin || allowedOrigins.length === 0) return done(true);
      return done(allowedOrigins.includes(origin));
    },
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    const url = new URL(req.url ?? path, 'http://localhost');
    const topicsParam = url.searchParams.get('topics') ?? '';
    const initialTopics = topicsParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    clientState.set(ws, { topics: new Set(initialTopics) });

    ws.send(
      JSON.stringify({
        event: 'connected',
        path,
        subscribedTopics: initialTopics,
        now: new Date().toISOString(),
      })
    );

    ws.on('message', (raw: any) => {
      const state = clientState.get(ws);
      if (!state) return;

      let msg: RealtimeMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON message' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ event: 'pong', now: new Date().toISOString() }));
        return;
      }

      if (msg.type === 'subscribe') {
        state.topics.add(msg.topic);
        ws.send(JSON.stringify({ event: 'subscribed', topic: msg.topic }));
        return;
      }

      if (msg.type === 'unsubscribe') {
        state.topics.delete(msg.topic);
        ws.send(JSON.stringify({ event: 'unsubscribed', topic: msg.topic }));
      }
    });
  });

  return wss;
}

export function broadcast(topic: Topic, event: string, data: unknown) {
  if (!wss) return;

  const payload: BroadcastEnvelope = {
    topic,
    event,
    publishedAt: new Date().toISOString(),
    data,
  };
  const msg = JSON.stringify(payload);

  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const state = clientState.get(ws);
    if (!state) continue;

    // Match either exact topic or a wildcard "forex" style subscription.
    if (!state.topics.has(topic) && !state.topics.has(topic.split(':')[0])) continue;
    ws.send(msg);
  }
}

export function publishForexUpdate(code: string, forex: unknown) {
  try {
    broadcast('forex', 'updated', { code, forex });
    broadcast(`forex:${code}`, 'updated', forex);
  } catch {
    // Never fail the main HTTP request because realtime couldn't publish.
  }
}

export function publishCommodityUpdate(code: string, commodity: unknown) {
  try {
    broadcast('commodity', 'updated', { code, commodity });
    broadcast(`commodity:${code}`, 'updated', commodity);
  } catch {
    // Never fail the main HTTP request because realtime couldn't publish.
  }
}

export function publishCryptoUpdate(symbol: string, crypto: unknown) {
  try {
    const sym = String(symbol).toUpperCase();
    broadcast('crypto', 'updated', { symbol: sym, crypto });
    broadcast(`crypto:${sym}`, 'updated', crypto);
  } catch {
    // Never fail the main HTTP request because realtime couldn't publish.
  }
}

export function publishForexInterbankUpdate(key: { id?: string; code?: string; bankCode?: string }, pair: unknown) {
  try {
    broadcast('forexInterbank', 'updated', { ...key, pair });
    if (key.bankCode) broadcast(`forexInterbank:${key.bankCode}`, 'updated', pair);
    if (key.code) broadcast(`forexInterbank:code:${key.code}`, 'updated', pair);
  } catch {
    // Never fail the main HTTP request because realtime couldn't publish.
  }
}

export function publishStockUpdate(key: { company_id?: string; ticker_symbol?: string }, payload: unknown) {
  try {
    broadcast('stocks', 'updated', { ...key, payload });
    if (key.company_id) broadcast(`stocks:${key.company_id}`, 'updated', payload);
    if (key.ticker_symbol) broadcast(`stocks:ticker:${key.ticker_symbol}`, 'updated', payload);
  } catch {
    // Never fail the main HTTP request because realtime couldn't publish.
  }
}

