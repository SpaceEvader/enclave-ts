import Decimal from 'decimal.js';
import * as https from 'https';
import { URL } from 'url';
import {
  API_URLS,
  ApiBalance,
  ApiError,
  ApiWrapper,
  Balance,
  ClientConfig,
  CreateOrderOptions,
  CreateStopOrderOptions,
  Environment,
  FundingRate,
  Market,
  MarketsResponse,
  Order,
  OrderBook,
  OrderSide,
  OrderType,
  Position,
  PositionDirection,
  StopOrder,
  StopOrderType,
  Ticker,
  Trade,
} from '../types';
import { HmacAuth } from './auth/HmacAuth';
import { roundDown } from '../utils/rounding';

export class EnclaveClient {
  private readonly baseUrl: string;
  private readonly auth?: HmacAuth;
  private readonly timeout: number;
  private readonly debug: boolean;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private marketsCache?: Market[];
  private marketsCacheTime?: number;
  private readonly CACHE_DURATION = 60000; // 1 minute

  constructor(config: ClientConfig = {}) {
    const environment = config.environment ?? Environment.PROD_PERMISSIONLESS;
    this.baseUrl = API_URLS[environment];
    this.auth = config.auth ? new HmacAuth(config.auth.apiKey, config.auth.apiSecret) : undefined;
    this.timeout = config.timeout ?? 30000;
    this.debug = config.debug ?? false;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  /**
   * Makes a request and automatically unwraps the API response wrapper
   */
  private async requestWithWrapper<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.request<ApiWrapper<T>>(method, path, body);
    if (!response.success) {
      throw new Error(response.error ?? 'Request failed');
    }
    return response.result;
  }

  private async request<T>(method: string, path: string, body?: unknown, attempt = 1): Promise<T> {
    const url = new URL(path, this.baseUrl);
    const bodyString = body ? JSON.stringify(body) : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.auth) {
      const authHeaders = this.auth.generateAuthHeaders(
        method,
        url.pathname + url.search,
        bodyString,
      );
      Object.assign(headers, authHeaders);
    }

    if (this.debug) {
      console.log(`[Enclave] ${method} ${url.toString()}`);
      if (body) console.log('[Enclave] Body:', body);
    }

    return new Promise((resolve, reject) => {
      const options = {
        method,
        headers,
        timeout: this.timeout,
      };

      const req = https.request(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (!res.statusCode) {
              throw new Error('No status code received');
            }

            if (res.statusCode === 429 && attempt <= this.maxRetries) {
              setTimeout(
                () => {
                  this.request<T>(method, path, body, attempt + 1)
                    .then(resolve)
                    .catch(reject);
                },
                this.retryDelay * Math.pow(2, attempt - 1),
              );
              return;
            }

            const parsed = data ? (JSON.parse(data) as Record<string, unknown>) : {};

            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed as T);
            } else {
              const error: ApiError = (parsed as { error?: ApiError }).error ?? {
                code: `HTTP_${res.statusCode}`,
                message: (parsed as { message?: string }).message ?? data ?? 'Request failed',
                details: parsed,
              };
              reject(error);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${String(e)}`));
          }
        });
      });

      req.on('error', (error) => {
        if (attempt <= this.maxRetries) {
          setTimeout(
            () => {
              this.request<T>(method, path, body, attempt + 1)
                .then(resolve)
                .catch(reject);
            },
            this.retryDelay * Math.pow(2, attempt - 1),
          );
        } else {
          reject(error);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      if (bodyString) {
        req.write(bodyString);
      }
      req.end();
    });
  }

  /**
   * Fetches all available markets from the exchange.
   *
   * @param useCache - Whether to use cached market data if available
   * @returns Array of market information
   *
   * @example
   * ```typescript
   * const markets = await client.getMarkets();
   * const btcMarket = markets.find(m => m.market === 'BTC-USD.P');
   * ```
   */
  public async getMarkets(useCache = true): Promise<Market[]> {
    if (
      useCache &&
      this.marketsCache &&
      this.marketsCacheTime &&
      Date.now() - this.marketsCacheTime < this.CACHE_DURATION
    ) {
      return this.marketsCache;
    }

    const response = await this.requestWithWrapper<MarketsResponse>('GET', '/v1/markets');
    const markets = response.perps.tradingPairs;
    this.marketsCache = markets;
    this.marketsCacheTime = Date.now();
    return markets;
  }

  /**
   * Fetches a specific market by symbol.
   *
   * @param market - Market symbol (e.g., "BTC-USD.P")
   * @returns Market information
   *
   * @throws Error if market not found
   *
   * @example
   * ```typescript
   * const btcMarket = await client.getMarket('BTC-USD.P');
   * console.log(`Min order size: ${btcMarket.minOrderSize}`);
   * ```
   */
  public async getMarket(market: string): Promise<Market> {
    const markets = await this.getMarkets();
    const found = markets.find((m) => m.market === market);
    if (!found) {
      throw new Error(`Market ${market} not found`);
    }
    return found;
  }

  /**
   * Creates a limit order on the specified market.
   *
   * @param market - Market symbol (e.g., "BTC-USD.P")
   * @param side - Order side (BUY or SELL)
   * @param size - Order size (will be rounded to base increment)
   * @param price - Limit price (will be rounded to quote increment)
   * @param options - Optional order parameters
   * @returns Created order
   *
   * @example
   * ```typescript
   * const order = await client.createLimitOrder(
   *   'BTC-USD.P',
   *   OrderSide.BUY,
   *   new Decimal(0.001),
   *   new Decimal(50000),
   *   { postOnly: true }
   * );
   * ```
   */
  public async createLimitOrder(
    market: string,
    side: OrderSide,
    size: Decimal,
    price: Decimal,
    options: CreateOrderOptions = {},
  ): Promise<Order> {
    const marketInfo = await this.getMarket(market);
    const roundedSize = roundDown(size, new Decimal(marketInfo.baseIncrement));
    const roundedPrice = roundDown(price, new Decimal(marketInfo.quoteIncrement));

    const body = {
      market,
      side,
      type: OrderType.LIMIT,
      size: roundedSize.toString(),
      price: roundedPrice.toString(),
      ...options,
    };

    return this.requestWithWrapper<Order>('POST', '/v1/perps/orders', body);
  }

  /**
   * Creates a market order on the specified market.
   *
   * @param market - Market symbol
   * @param side - Order side (BUY or SELL)
   * @param size - Order size for SELL, quote size for BUY
   * @param options - Optional order parameters
   * @returns Created order
   *
   * @example
   * ```typescript
   * // Market buy with $1000 USDT
   * const buyOrder = await client.createMarketOrder(
   *   'BTC-USD.P',
   *   OrderSide.BUY,
   *   new Decimal(1000)
   * );
   *
   * // Market sell 0.001 BTC
   * const sellOrder = await client.createMarketOrder(
   *   'BTC-USD.P',
   *   OrderSide.SELL,
   *   new Decimal(0.001)
   * );
   * ```
   */
  public async createMarketOrder(
    market: string,
    side: OrderSide,
    size: Decimal,
    options: CreateOrderOptions = {},
  ): Promise<Order> {
    const marketInfo = await this.getMarket(market);

    const body: Record<string, unknown> = {
      market,
      side,
      type: OrderType.MARKET,
      ...options,
    };

    if (side === OrderSide.BUY) {
      const roundedQuoteSize = roundDown(size, new Decimal(marketInfo.quoteIncrement));
      body.quoteSize = roundedQuoteSize.toString();
    } else {
      const roundedSize = roundDown(size, new Decimal(marketInfo.baseIncrement));
      body.size = roundedSize.toString();
    }

    return this.requestWithWrapper<Order>('POST', '/v1/perps/orders', body);
  }

  /**
   * Cancels an open order.
   *
   * @param orderId - The order ID to cancel
   * @returns The cancelled order
   *
   * @example
   * ```typescript
   * const cancelledOrder = await client.cancelOrder('order-123');
   * ```
   */
  public async cancelOrder(orderId: string): Promise<Order> {
    return this.requestWithWrapper<Order>('DELETE', `/v1/perps/orders/${orderId}`);
  }

  /**
   * Cancels all open orders for a market or all markets.
   *
   * @param market - Optional market to cancel orders for
   * @returns Array of cancelled orders
   *
   * @example
   * ```typescript
   * // Cancel all orders
   * const cancelled = await client.cancelAllOrders();
   *
   * // Cancel all BTC orders
   * const cancelledBtc = await client.cancelAllOrders('BTC-USD.P');
   * ```
   */
  public async cancelAllOrders(market?: string): Promise<Order[]> {
    const params = market ? `?market=${market}` : '';
    return this.requestWithWrapper<Order[]>('DELETE', `/v1/perps/orders${params}`);
  }

  /**
   * Fetches open orders.
   *
   * @param market - Optional market filter
   * @returns Array of open orders
   *
   * @example
   * ```typescript
   * const openOrders = await client.getOrders();
   * const btcOrders = await client.getOrders('BTC-USD.P');
   * ```
   */
  public async getOrders(market?: string): Promise<Order[]> {
    const params = market ? `?market=${market}` : '';
    return this.requestWithWrapper<Order[]>('GET', `/v1/perps/orders${params}`);
  }

  /**
   * Fetches a specific order by ID.
   *
   * @param orderId - The order ID
   * @returns Order details
   *
   * @example
   * ```typescript
   * const order = await client.getOrder('order-123');
   * ```
   */
  public async getOrder(orderId: string): Promise<Order> {
    return this.requestWithWrapper<Order>('GET', `/v1/perps/orders/${orderId}`);
  }

  /**
   * Fetches all open positions.
   *
   * @param market - Optional market filter
   * @returns Array of positions
   *
   * @example
   * ```typescript
   * const positions = await client.getPositions();
   * const btcPosition = positions.find(p => p.market === 'BTC-USD.P');
   * ```
   */
  public async getPositions(market?: string): Promise<Position[]> {
    const params = market ? `?market=${market}` : '';
    return this.requestWithWrapper<Position[]>('GET', `/v1/perps/positions${params}`);
  }

  /**
   * Creates a stop order (stop loss or take profit).
   *
   * @param market - Market symbol
   * @param positionDirection - Direction of the position to protect
   * @param type - Stop order type (STOP_LOSS or TAKE_PROFIT)
   * @param triggerPrice - Price at which to trigger the stop
   * @param options - Optional parameters
   * @returns Created stop order
   *
   * @example
   * ```typescript
   * // Create stop loss for long position
   * const stopLoss = await client.createStopOrder(
   *   'BTC-USD.P',
   *   PositionDirection.LONG,
   *   StopOrderType.STOP_LOSS,
   *   new Decimal(45000)
   * );
   *
   * // Create take profit for short position
   * const takeProfit = await client.createStopOrder(
   *   'BTC-USD.P',
   *   PositionDirection.SHORT,
   *   StopOrderType.TAKE_PROFIT,
   *   new Decimal(40000)
   * );
   * ```
   */
  public async createStopOrder(
    market: string,
    positionDirection: PositionDirection,
    type: StopOrderType,
    triggerPrice: Decimal,
    options: CreateStopOrderOptions = {},
  ): Promise<StopOrder> {
    const marketInfo = await this.getMarket(market);
    const roundedPrice = roundDown(triggerPrice, new Decimal(marketInfo.quoteIncrement));

    const body = {
      market,
      positionDirection,
      type,
      triggerPrice: roundedPrice.toString(),
      ...options,
    };

    return this.requestWithWrapper<StopOrder>('POST', '/v1/perps/stop_order', body);
  }

  /**
   * Cancels a stop order.
   *
   * @param stopOrderId - The stop order ID
   * @returns The cancelled stop order
   *
   * @example
   * ```typescript
   * const cancelled = await client.cancelStopOrder('stop-123');
   * ```
   */
  public async cancelStopOrder(stopOrderId: string): Promise<StopOrder> {
    return this.requestWithWrapper<StopOrder>('DELETE', `/v1/perps/stop_order/${stopOrderId}`);
  }

  /**
   * Fetches stop orders.
   *
   * @param market - Optional market filter
   * @returns Array of stop orders
   *
   * @example
   * ```typescript
   * const stopOrders = await client.getStopOrders();
   * ```
   */
  public async getStopOrders(market?: string): Promise<StopOrder[]> {
    const params = market ? `?market=${market}` : '';
    return this.requestWithWrapper<StopOrder[]>('GET', `/v1/perps/stop_order${params}`);
  }

  /**
   * Fetches account balance information.
   *
   * @returns Balance information
   *
   * @example
   * ```typescript
   * const balance = await client.getBalance();
   * console.log(`Available margin: ${balance.availableMargin}`);
   * ```
   */
  public async getBalance(): Promise<Balance> {
    const apiBalance = await this.requestWithWrapper<ApiBalance>('GET', '/v1/perps/balance');

    // Map API response to our Balance interface
    return {
      asset: 'USDT', // Enclave uses USDT as base asset
      available: apiBalance.availableMargin,
      locked: apiBalance.totalOrderMargin || '0',
      total: apiBalance.walletBalance,
      inPositions: apiBalance.totalPositionValue || '0',
      unrealizedPnl: apiBalance.unrealizedPnl,
      marginBalance: apiBalance.marginBalance,
      maintenanceMargin: apiBalance.maintenanceMargin,
      initialMargin: apiBalance.initialMargin,
      availableMargin: apiBalance.availableMargin,
      walletBalance: apiBalance.walletBalance,
      totalPositionValue: apiBalance.totalPositionValue,
      totalOrderMargin: apiBalance.totalOrderMargin,
    };
  }

  /**
   * Fetches funding rates for a market.
   *
   * @param market - Market symbol
   * @param limit - Number of rates to fetch
   * @returns Array of funding rates
   *
   * @example
   * ```typescript
   * const rates = await client.getFundingRates('BTC-USD.P', 24);
   * ```
   */
  public async getFundingRates(market: string, limit = 100): Promise<FundingRate[]> {
    return this.requestWithWrapper<FundingRate[]>(
      'GET',
      `/v1/perps/funding_rates?market=${market}&limit=${limit}`,
    );
  }

  /**
   * Fetches trade history.
   *
   * @param market - Optional market filter
   * @param limit - Number of trades to fetch
   * @returns Array of trades
   *
   * @example
   * ```typescript
   * const trades = await client.getTrades('BTC-USD.P', 100);
   * ```
   */
  public async getTrades(market?: string, limit = 100): Promise<Trade[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (market) params.append('market', market);
    return this.requestWithWrapper<Trade[]>('GET', `/v1/perps/trades?${params.toString()}`);
  }

  /**
   * Fetches the order book for a market.
   *
   * @param market - Market symbol
   * @param depth - Number of price levels
   * @returns Order book snapshot
   *
   * @example
   * ```typescript
   * const orderBook = await client.getOrderBook('BTC-USD.P', 20);
   * console.log(`Best bid: ${orderBook.bids[0][0]}`);
   * console.log(`Best ask: ${orderBook.asks[0][0]}`);
   * ```
   */
  public async getOrderBook(market: string, depth = 20): Promise<OrderBook> {
    return this.requestWithWrapper<OrderBook>(
      'GET',
      `/v1/perps/orderbook?market=${market}&depth=${depth}`,
    );
  }

  /**
   * Fetches ticker information for markets.
   *
   * @param market - Optional market filter
   * @returns Ticker or array of tickers
   *
   * @example
   * ```typescript
   * const ticker = await client.getTicker('BTC-USD.P');
   * const allTickers = await client.getTicker();
   * ```
   */
  public async getTicker(market?: string): Promise<Ticker | Ticker[]> {
    const path = market ? `/v1/perps/ticker?market=${market}` : '/v1/perps/ticker';
    return this.requestWithWrapper<Ticker | Ticker[]>('GET', path);
  }
}
