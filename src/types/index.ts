export enum Environment {
  PROD = 'PROD',
  PROD_PERMISSIONLESS = 'PROD_PERMISSIONLESS',
  SANDBOX = 'SANDBOX',
  SANDBOX_PERMISSIONLESS = 'SANDBOX_PERMISSIONLESS',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
}

export enum TimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
}

export enum PositionDirection {
  LONG = 'long',
  SHORT = 'short',
}

export enum StopOrderType {
  STOP_LOSS = 'stopLoss',
  TAKE_PROFIT = 'takeProfit',
}

export interface Market {
  market: string;
  baseAsset: string;
  quoteAsset: string;
  baseIncrement: string;
  quoteIncrement: string;
  minOrderSize: string;
  maxOrderSize: string;
  maxLeverage: number;
  initialMargin: string;
  maintenanceMargin: string;
  maxPositionSize: string;
  makerFee: string;
  takerFee: string;
  fundingRate?: string;
  nextFundingTime?: number;
  openInterest?: string;
  volume24h?: string;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  market: string;
  side: OrderSide;
  type: OrderType;
  price?: string;
  size: string;
  remainingSize: string;
  status: OrderStatus;
  timeInForce?: TimeInForce;
  postOnly?: boolean;
  createdAt: number;
  updatedAt: number;
  filledSize?: string;
  avgFillPrice?: string;
  fee?: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  PARTIALLY_FILLED = 'partiallyFilled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export interface Position {
  market: string;
  side: PositionDirection;
  size: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  margin: string;
  leverage: number;
  createdAt: number;
  updatedAt: number;
}

export interface StopOrder {
  id: string;
  market: string;
  positionDirection: PositionDirection;
  type: StopOrderType;
  triggerPrice: string;
  status: StopOrderStatus;
  createdAt: number;
  updatedAt: number;
}

export enum StopOrderStatus {
  PENDING = 'pending',
  TRIGGERED = 'triggered',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export interface Balance {
  asset: string;
  available: string;
  locked: string;
  total: string;
  inPositions: string;
  unrealizedPnl: string;
  marginBalance: string;
  maintenanceMargin: string;
  initialMargin: string;
  availableMargin: string;
  walletBalance?: string; // Add API field
  totalPositionValue?: string;
  totalOrderMargin?: string;
}

export interface FundingRate {
  market: string;
  rate: string;
  intervalEnds: string;
  premiums: Array<{
    timestamp: string;
    premium: string;
  }>;
}

export interface Trade {
  id: string;
  market: string;
  side: OrderSide;
  price: string;
  size: string;
  fee: string;
  timestamp: number;
  orderId: string;
  maker: boolean;
}

export interface OrderBook {
  market: string;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
  timestamp: number;
  sequenceNumber?: number;
}

export interface Ticker {
  market: string;
  bid: string;
  ask: string;
  last: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  volumeQuote24h: string;
  change24h: string;
  changePercent24h: string;
  openInterest?: string;
  fundingRate?: string;
  markPrice?: string;
  indexPrice?: string;
  timestamp: number;
}

export interface CreateOrderOptions {
  clientOrderId?: string;
  postOnly?: boolean;
  reduceOnly?: boolean;
  timeInForce?: TimeInForce;
}

export interface CreateStopOrderOptions {
  clientOrderId?: string;
  size?: string;
  reduceOnly?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Actual API response wrapper used by Enclave
export interface ApiWrapper<T> {
  success: boolean;
  result: T;
  error?: string;
}

// Markets response structure
export interface MarketsResponse {
  perps: {
    tradingPairs: Market[];
  };
}

// Balance response structure (with actual field names from API)
export interface ApiBalance {
  walletBalance: string;
  availableMargin: string;
  unrealizedPnl: string;
  marginBalance: string;
  initialMargin: string;
  maintenanceMargin: string;
  totalPositionValue: string;
  totalOrderMargin: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface WebSocketMessage {
  channel: string;
  type: string;
  data: unknown;
  sequence?: number;
  timestamp?: number;
}

export interface AuthConfig {
  apiKey: string;
  apiSecret: string;
}

export interface ClientConfig {
  auth?: AuthConfig;
  environment?: Environment;
  timeout?: number;
  debug?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export const API_URLS: Record<Environment, string> = {
  [Environment.PROD]: 'https://api.enclave.market',
  [Environment.PROD_PERMISSIONLESS]: 'https://api.enclave.trade',
  [Environment.SANDBOX]: 'https://api-sandbox.enclave.market',
  [Environment.SANDBOX_PERMISSIONLESS]: 'https://api-sandbox.enclave.trade',
};

export const WS_URLS: Record<Environment, string> = {
  [Environment.PROD]: 'wss://api.enclave.market/ws',
  [Environment.PROD_PERMISSIONLESS]: 'wss://api.enclave.trade/ws',
  [Environment.SANDBOX]: 'wss://api-sandbox.enclave.market/ws',
  [Environment.SANDBOX_PERMISSIONLESS]: 'wss://api-sandbox.enclave.trade/ws',
};

// Re-export API response types
export * from './api-responses';
