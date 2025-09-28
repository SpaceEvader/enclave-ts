/**
 * WebSocket client for real-time data streaming from Enclave Markets
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { HmacAuth } from '../auth/HmacAuth';
import { Environment, WS_URLS } from '../../types';

export interface WebSocketConfig {
  auth?: HmacAuth;
  environment?: Environment;
  debug?: boolean;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketMessage {
  channel: string;
  type: string;
  data: unknown;
  sequence?: number;
  timestamp?: number;
}

export type MessageHandler = (data: unknown) => void;

export interface Subscription {
  channel: string;
  market?: string;
  handler: MessageHandler;
}

/**
 * WebSocket channels available for subscription
 */
export enum WebSocketChannel {
  PRICES = 'prices',
  TRADES = 'tradesPerps',
  ORDERBOOK = 'topOfBooksPerps',
  ORDERS = 'ordersPerps',
  POSITIONS = 'positionsPerps',
  DEPOSITS = 'deposits',
}

/**
 * WebSocket client for real-time data streaming
 */
export class WebSocketClient extends EventEmitter {
  private ws?: WebSocket;
  private config: WebSocketConfig;
  private subscriptions: Map<string, Set<MessageHandler>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private heartbeatInterval?: NodeJS.Timeout;
  private sequenceNumber = 0;
  private reconnectTimeout?: NodeJS.Timeout;

  constructor(config: WebSocketConfig = {}) {
    super();

    this.config = {
      auth: config.auth,
      environment: config.environment ?? Environment.PROD_PERMISSIONLESS,
      debug: config.debug ?? false,
      reconnect: config.reconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const environment = this.config.environment ?? Environment.PROD_PERMISSIONLESS;
      const wsUrl = WS_URLS[environment];

      if (!wsUrl) {
        reject(new Error(`Invalid environment: ${environment}`));
        return;
      }

      if (this.config.debug) {
        console.log(`[WS] Connecting to ${wsUrl}`);
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        if (this.config.debug) {
          console.log('[WS] Connected');
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.startHeartbeat();

        // Authenticate if credentials provided
        if (this.config.auth) {
          this.authenticate();
        }

        // Resubscribe to all channels
        this.resubscribeAll();

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          let strData: string;
          if (typeof data === 'string') {
            strData = data;
          } else if (Buffer.isBuffer(data)) {
            strData = data.toString('utf8');
          } else if (data instanceof ArrayBuffer) {
            strData = Buffer.from(data).toString('utf8');
          } else {
            // Array of Buffers
            strData = Buffer.concat(data as Buffer[]).toString('utf8');
          }
          const message = JSON.parse(strData) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          if (this.config.debug) {
            console.error('[WS] Failed to parse message:', error);
          }
        }
      });

      this.ws.on('error', (error: Error) => {
        if (this.config.debug) {
          console.error('[WS] Error:', error);
        }
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code: number, reason: string) => {
        if (this.config.debug) {
          console.log(`[WS] Disconnected: ${code} ${reason}`);
        }
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code, reason });

        // Attempt reconnection if enabled
        if (
          this.config.reconnect &&
          this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 10)
        ) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('ping', () => {
        if (this.config.debug) {
          console.log('[WS] Received ping');
        }
        this.ws?.pong();
      });
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.config.reconnect = false; // Prevent auto-reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.isConnected = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Subscribe to a channel
   */
  public subscribe(channel: WebSocketChannel, handler: MessageHandler, market?: string): void {
    const key = this.getSubscriptionKey(channel, market);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    this.subscriptions.get(key)!.add(handler);

    // Send subscription message if connected
    if (this.isConnected) {
      this.sendSubscribe(channel, market);
    }
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe(channel: WebSocketChannel, handler?: MessageHandler, market?: string): void {
    const key = this.getSubscriptionKey(channel, market);

    if (!handler) {
      // Unsubscribe all handlers for this channel
      this.subscriptions.delete(key);
    } else {
      // Unsubscribe specific handler
      const handlers = this.subscriptions.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    }

    // Send unsubscribe message if connected and no more handlers
    if (this.isConnected && !this.subscriptions.has(key)) {
      this.sendUnsubscribe(channel, market);
    }
  }

  /**
   * Send a message to the server
   */
  private send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      if (this.config.debug) {
        console.log('[WS] Sent:', message);
      }
    }
  }

  /**
   * Authenticate with the server
   */
  private authenticate(): void {
    if (!this.config.auth) return;

    const timestamp = Date.now();
    const message = `${timestamp}WS_AUTH`;
    const signature = this.config.auth.sign(message);

    this.send({
      op: 'auth',
      timestamp,
      apiKey: this.config.auth.getApiKey(),
      signature,
    });
  }

  /**
   * Send subscription message
   */
  private sendSubscribe(channel: WebSocketChannel, market?: string): void {
    const message: Record<string, unknown> = {
      op: 'subscribe',
      channel,
    };

    if (market) {
      message.market = market;
    }

    this.send(message);
  }

  /**
   * Send unsubscription message
   */
  private sendUnsubscribe(channel: WebSocketChannel, market?: string): void {
    const message: Record<string, unknown> = {
      op: 'unsubscribe',
      channel,
    };

    if (market) {
      message.market = market;
    }

    this.send(message);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    if (this.config.debug) {
      console.log('[WS] Received:', message);
    }

    // Handle different message types
    if (message.type === 'subscribed') {
      this.emit('subscribed', message);
      return;
    }

    if (message.type === 'unsubscribed') {
      this.emit('unsubscribed', message);
      return;
    }

    if (message.type === 'error') {
      const errorMessage = (message.data as { message?: string })?.message ?? 'Unknown error';
      this.emit('error', new Error(errorMessage));
      return;
    }

    // Route message to channel handlers
    const key = this.getSubscriptionKey(
      message.channel as WebSocketChannel,
      (message.data as { market?: string })?.market,
    );
    const handlers = this.subscriptions.get(key);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.data);
        } catch (error) {
          if (this.config.debug) {
            console.error('[WS] Handler error:', error);
          }
          this.emit('error', error);
        }
      });
    }

    // Update sequence number
    if (message.sequence) {
      this.sequenceNumber = message.sequence;
    }

    // Emit raw message event
    this.emit('message', message);
  }

  /**
   * Get subscription key for channel and market
   */
  private getSubscriptionKey(channel: WebSocketChannel, market?: string): string {
    return market ? `${channel}:${market}` : channel;
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribeAll(): void {
    for (const [key] of this.subscriptions) {
      const [channel, market] = key.split(':');
      this.sendSubscribe(channel as WebSocketChannel, market);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        if (this.config.debug) {
          console.log('[WS] Sent ping');
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay =
      (this.config.reconnectDelay ?? 5000) * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));

    if (this.config.debug) {
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        if (this.config.debug) {
          console.error('[WS] Reconnection failed:', error);
        }
      });
    }, delay);
  }

  /**
   * Check if connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current sequence number
   */
  public get sequence(): number {
    return this.sequenceNumber;
  }
}
