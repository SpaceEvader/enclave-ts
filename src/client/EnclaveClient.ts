import Decimal from 'decimal.js';
import * as https from 'https';
import { URL } from 'url';
import {
  API_URLS,
  ApiBalance,
  ApiWrapper,
  Balance,
  ClientConfig,
  CreateOrderOptions,
  CreateStopOrderOptions,
  Environment,
  FundingRate,
  Market,
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
import { EnclaveApiError } from '../utils/errors';
import { ApiMarketsResponse, ApiTrade, ApiOrderBook } from '../types/api-responses';
import { adaptMarketsResponse, adaptTrade, adaptOrderBook } from '../utils/adapters';
import { WebSocketClient, WebSocketChannel, MessageHandler } from './websocket/WebSocketClient';

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
  private wsClient?: WebSocketClient;
  private readonly environment: Environment;

  constructor(config: ClientConfig = {}) {
    this.environment = config.environment ?? Environment.PROD_PERMISSIONLESS;
    this.baseUrl = API_URLS[this.environment];
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
      throw new EnclaveApiError(response.error ?? 'Request failed', path, method);
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
              throw new EnclaveApiError('No status code received', path, method);
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
              const errorMessage =
                (parsed as { error?: string }).error ??
                (parsed as { message?: string }).message ??
                data ??
                'Request failed';
              reject(new EnclaveApiError(errorMessage, path, method, res.statusCode, data));
            }
          } catch (e) {
            reject(
              new EnclaveApiError(
                `Failed to parse response: ${String(e)}`,
                path,
                method,
                res.statusCode,
                data,
              ),
            );
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

    const response = await this.requestWithWrapper<ApiMarketsResponse>('GET', '/v1/markets');
    const markets = adaptMarketsResponse(response);
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
   * Gets the available margin balance as a Decimal for easy calculations.
   * Convenience method that fetches balance and returns available margin.
   *
   * @returns Available margin as a Decimal
   *
   * @example
   * ```typescript
   * const available = await client.getAvailableBalance();
   * console.log(`Available margin: ${available.toFixed(2)} USDT`);
   * ```
   */
  public async getAvailableBalance(): Promise<Decimal> {
    const balance = await this.getBalance();
    return new Decimal(balance.availableMargin);
  }

  /**
   * Checks if the account has enough margin for a trade.
   * Convenience method for margin validation.
   *
   * @param requiredMargin - Amount of margin required
   * @returns True if account has sufficient margin
   *
   * @example
   * ```typescript
   * const orderValue = new Decimal(100); // 100 USDT
   * if (await client.hasEnoughMargin(orderValue)) {
   *   await client.createLimitOrder(...);
   * } else {
   *   console.log('Insufficient margin');
   * }
   * ```
   */
  public async hasEnoughMargin(requiredMargin: Decimal | number | string): Promise<boolean> {
    const available = await this.getAvailableBalance();
    const required = new Decimal(requiredMargin);
    return available.greaterThanOrEqualTo(required);
  }

  /**
   * Fetches funding rates for a market.
   *
   * NOTE: The API does not support limit parameter.
   * Returns the current funding rate and premium history.
   *
   * @param market - Market symbol
   * @returns Funding rate information
   *
   * @example
   * ```typescript
   * const fundingRate = await client.getFundingRates('BTC-USD.P');
   * console.log(`Current rate: ${fundingRate.rate}`);
   * console.log(`Interval ends: ${fundingRate.intervalEnds}`);
   * ```
   */
  public async getFundingRates(market: string): Promise<FundingRate> {
    // API returns a single funding rate object, not an array
    return this.requestWithWrapper<FundingRate>('GET', `/v1/perps/funding_rates?market=${market}`);
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
    const response = await this.requestWithWrapper<ApiTrade[]>(
      'GET',
      `/v1/perps/trades?${params.toString()}`,
    );
    return response.map(adaptTrade);
  }

  /**
   * Fetches the order book for a market.
   *
   * @param market - Market symbol
   * @param depth - Number of price levels (optional)
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
    // The actual endpoint is /v1/perps/depth, not /v1/perps/orderbook
    const params = new URLSearchParams({ market });
    if (depth) {
      params.append('depth', depth.toString());
    }
    const response = await this.requestWithWrapper<ApiOrderBook>(
      'GET',
      `/v1/perps/depth?${params.toString()}`,
    );
    return adaptOrderBook(response);
  }

  /**
   * Fetches ticker information for markets.
   *
   * NOTE: The ticker endpoint (/v1/ticker) is only available for spot markets.
   * For perpetual markets, use getTrades() to get the latest price information.
   *
   * @param market - Optional market filter
   * @returns Ticker or array of tickers
   * @throws Error - Not available for perpetual markets
   *
   * @example
   * ```typescript
   * // For perpetual markets, use trades instead:
   * const trades = await client.getTrades('BTC-USD.P', 1);
   * const latestPrice = trades[0]?.price;
   *
   * // For orderbook bid/ask, use:
   * const orderBook = await client.getOrderBook('BTC-USD.P', 1);
   * const bestBid = orderBook.bids[0]?.[0];
   * const bestAsk = orderBook.asks[0]?.[0];
   * ```
   */
  public getTicker(_market?: string): Promise<Ticker | Ticker[]> {
    // Ticker endpoint only exists for spot markets (/v1/ticker), not for perps
    return Promise.reject(
      new Error(
        'Ticker endpoint is not available for perpetual markets. ' +
          'Use getLatestPrice() or getBidAsk() instead.',
      ),
    );
  }

  /**
   * Helper method to get the latest traded price for a market.
   *
   * @param market - Market symbol
   * @returns Latest traded price as a string
   *
   * @example
   * ```typescript
   * const price = await client.getLatestPrice('BTC-USD.P');
   * console.log(`Current BTC price: ${price}`);
   * ```
   */
  public async getLatestPrice(market: string): Promise<string | null> {
    const trades = await this.getTrades(market, 1);
    return trades[0]?.price || null;
  }

  /**
   * Helper method to get the current bid and ask prices.
   *
   * @param market - Market symbol
   * @returns Object with bid, ask, and spread
   *
   * @example
   * ```typescript
   * const { bid, ask, spread } = await client.getBidAsk('BTC-USD.P');
   * console.log(`Bid: ${bid}, Ask: ${ask}, Spread: ${spread}`);
   * ```
   */
  public async getBidAsk(
    market: string,
  ): Promise<{ bid: string | null; ask: string | null; spread: string | null }> {
    const orderBook = await this.getOrderBook(market, 1);

    const bid = orderBook.bids[0]?.[0] || null;
    const ask = orderBook.asks[0]?.[0] || null;

    let spread: string | null = null;
    if (bid && ask) {
      spread = new Decimal(ask).minus(bid).toString();
    }

    return { bid, ask, spread };
  }

  // ==================== WebSocket Methods ====================

  /**
   * Initialize WebSocket connection for real-time data.
   *
   * @returns Promise that resolves when connected
   *
   * @example
   * ```typescript
   * await client.connectWebSocket();
   * client.subscribeTrades('BTC-USD.P', (trade) => {
   *   console.log('New trade:', trade);
   * });
   * ```
   */
  public async connectWebSocket(): Promise<void> {
    if (!this.wsClient) {
      this.wsClient = new WebSocketClient({
        auth: this.auth,
        environment: this.environment,
        debug: this.debug,
      });
    }

    return this.wsClient.connect();
  }

  /**
   * Disconnect WebSocket connection.
   */
  public disconnectWebSocket(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = undefined;
    }
  }

  /**
   * Subscribe to real-time trade updates.
   *
   * @param market - Market symbol
   * @param handler - Callback function for trade updates
   *
   * @example
   * ```typescript
   * client.subscribeTrades('BTC-USD.P', (trade) => {
   *   console.log(`Trade: ${trade.size} @ ${trade.price}`);
   * });
   * ```
   */
  public subscribeTrades(market: string, handler: MessageHandler): void {
    if (!this.wsClient) {
      throw new Error('WebSocket not connected. Call connectWebSocket() first.');
    }
    this.wsClient.subscribe(WebSocketChannel.TRADES, handler, market);
  }

  /**
   * Unsubscribe from trade updates.
   */
  public unsubscribeTrades(market: string, handler?: MessageHandler): void {
    if (this.wsClient) {
      this.wsClient.unsubscribe(WebSocketChannel.TRADES, handler, market);
    }
  }

  /**
   * Subscribe to real-time order book updates.
   *
   * @param market - Market symbol
   * @param handler - Callback function for order book updates
   *
   * @example
   * ```typescript
   * client.subscribeOrderBook('BTC-USD.P', (book) => {
   *   console.log(`Best bid: ${book.bids[0][0]}, Best ask: ${book.asks[0][0]}`);
   * });
   * ```
   */
  public subscribeOrderBook(market: string, handler: MessageHandler): void {
    if (!this.wsClient) {
      throw new Error('WebSocket not connected. Call connectWebSocket() first.');
    }
    this.wsClient.subscribe(WebSocketChannel.ORDERBOOK, handler, market);
  }

  /**
   * Unsubscribe from order book updates.
   */
  public unsubscribeOrderBook(market: string, handler?: MessageHandler): void {
    if (this.wsClient) {
      this.wsClient.unsubscribe(WebSocketChannel.ORDERBOOK, handler, market);
    }
  }

  /**
   * Subscribe to real-time order updates (requires authentication).
   *
   * @param handler - Callback function for order updates
   *
   * @example
   * ```typescript
   * client.subscribeOrders((order) => {
   *   console.log(`Order ${order.id}: ${order.status}`);
   * });
   * ```
   */
  public subscribeOrders(handler: MessageHandler): void {
    if (!this.wsClient) {
      throw new Error('WebSocket not connected. Call connectWebSocket() first.');
    }
    if (!this.auth) {
      throw new Error('Authentication required for order subscription.');
    }
    this.wsClient.subscribe(WebSocketChannel.ORDERS, handler);
  }

  /**
   * Unsubscribe from order updates.
   */
  public unsubscribeOrders(handler?: MessageHandler): void {
    if (this.wsClient) {
      this.wsClient.unsubscribe(WebSocketChannel.ORDERS, handler);
    }
  }

  /**
   * Subscribe to real-time position updates (requires authentication).
   *
   * @param handler - Callback function for position updates
   *
   * @example
   * ```typescript
   * client.subscribePositions((position) => {
   *   console.log(`Position ${position.market}: ${position.size} @ ${position.entryPrice}`);
   * });
   * ```
   */
  public subscribePositions(handler: MessageHandler): void {
    if (!this.wsClient) {
      throw new Error('WebSocket not connected. Call connectWebSocket() first.');
    }
    if (!this.auth) {
      throw new Error('Authentication required for position subscription.');
    }
    this.wsClient.subscribe(WebSocketChannel.POSITIONS, handler);
  }

  /**
   * Unsubscribe from position updates.
   */
  public unsubscribePositions(handler?: MessageHandler): void {
    if (this.wsClient) {
      this.wsClient.unsubscribe(WebSocketChannel.POSITIONS, handler);
    }
  }

  /**
   * Check if WebSocket is connected.
   */
  public get isWebSocketConnected(): boolean {
    return this.wsClient?.connected ?? false;
  }
}
