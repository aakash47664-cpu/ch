import { ProcessUpdatePayload } from '../types';

type MessageCallback = (data: ProcessUpdatePayload) => void;

export const getWebSocketUrl = (): string => {
  // 1. Explicit VITE_WS_URL from environment
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL.trim();
  }

  // 2. Derive from VITE_API_URL if configured
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '');
    const wsBase = apiUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    return `${wsBase}/ws`;
  }

  // 3. In browser dev mode (e.g. port 5173), connect directly to localhost:8000
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
    return `${protocol}//${host}/ws`;
  }

  return 'ws://localhost:8000/ws';
};

class WebSocketClient {
  private socket: WebSocket | null = null;
  private subscribers: Set<MessageCallback> = new Set();
  private reconnectInterval = 2000;
  private shouldReconnect = true;
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = getWebSocketUrl();

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        console.log(' Connected to ChemDiag AI WebSocket stream');
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ProcessUpdatePayload;
          this.subscribers.forEach((cb) => cb(payload));
        } catch (e) {
          console.error('Error parsing WebSocket payload:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        if (this.shouldReconnect) {
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        this.socket?.close();
      };
    } catch (err) {
      this.isConnecting = false;
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    }
  }

  public subscribe(cb: MessageCallback) {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public close() {
    this.shouldReconnect = false;
    this.socket?.close();
  }
}

export const wsClient = new WebSocketClient();
