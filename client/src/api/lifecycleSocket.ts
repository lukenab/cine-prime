export type LifecycleAggregate = "MOVIE" | "RELEASE_PLAN" | "SCHEDULE_PLAN";

export type LifecycleChangeEvent = {
  aggregateType: LifecycleAggregate;
  aggregateId: number;
  status: string;
  action: string;
  movieId?: number;
  clusterId?: number;
  occurredAt: string;
};

type Listener = (event: LifecycleChangeEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

function lifecycleWebSocketUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
  const url = new URL(apiBase, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/lifecycle";
  url.search = "";
  return url.toString();
}

function scheduleReconnect() {
  if (listeners.size === 0 || reconnectTimer) return;
  const delay = Math.min(10_000, 1_000 * 2 ** Math.min(reconnectAttempts, 3));
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (listeners.size === 0 || socket?.readyState === WebSocket.OPEN
      || socket?.readyState === WebSocket.CONNECTING) return;

  const nextSocket = new WebSocket(lifecycleWebSocketUrl());
  socket = nextSocket;

  nextSocket.onopen = () => {
    reconnectAttempts = 0;
  };
  nextSocket.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as LifecycleChangeEvent;
      if (!event.aggregateType || !event.aggregateId) return;
      listeners.forEach((listener) => listener(event));
    } catch {
      // Ignore malformed invalidation messages; REST remains the source of truth.
    }
  };
  nextSocket.onerror = () => nextSocket.close();
  nextSocket.onclose = () => {
    if (socket === nextSocket) socket = null;
    scheduleReconnect();
  };
}

export function subscribeLifecycleEvents(listener: Listener): () => void {
  listeners.add(listener);
  connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const activeSocket = socket;
    socket = null;
    if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.close(1000, "No subscribers");
    else if (activeSocket?.readyState === WebSocket.CONNECTING) {
      activeSocket.onopen = () => activeSocket.close(1000, "No subscribers");
    }
  };
}
