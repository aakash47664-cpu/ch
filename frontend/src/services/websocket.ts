import { ProcessUpdatePayload } from '../types';

type MessageCallback = (data: ProcessUpdatePayload) => void;

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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running under vite dev server, proxy /ws or connect to localhost:8000
    const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

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
