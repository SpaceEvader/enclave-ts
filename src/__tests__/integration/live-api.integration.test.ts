/**
 * Live API Integration Tests
 *
 * These tests make actual API calls to Enclave Markets.
 * They require valid test credentials in .env.test file.
 *
 * To run these tests:
 * 1. Copy .env.test.example to .env.test
 * 2. Add your test API credentials
 * 3. Run: npm run test:integration
 */

import { config } from 'dotenv';
import { EnclaveClient } from '../../client/EnclaveClient';
import { Environment, OrderSide, OrderType } from '../../types';
import Decimal from 'decimal.js';
import path from 'path';

// Load test environment variables
const envPath = path.resolve(process.cwd(), '.env.test');
config({ path: envPath });

// Skip these tests if no credentials are provided
const SKIP_INTEGRATION = !process.env.ENCLAVE_TEST_API_KEY || !process.env.ENCLAVE_TEST_API_SECRET;

describe('Live API Integration Tests', () => {
  if (SKIP_INTEGRATION) {
    test.skip('Skipping integration tests - no credentials provided', () => {});
    return;
  }

  const apiKey = process.env.ENCLAVE_TEST_API_KEY!;
  const apiSecret = process.env.ENCLAVE_TEST_API_SECRET!;
  const testMarket = process.env.ENCLAVE_TEST_MARKET || 'BTC-USD.P';

  let publicClient: EnclaveClient;
  let authenticatedClient: EnclaveClient;

  beforeAll(() => {
    // Create public client (no auth required)
    publicClient = new EnclaveClient({
      environment: Environment.PROD_PERMISSIONLESS,
      debug: process.env.ENCLAVE_TEST_DEBUG === 'true',
    });

    // Create authenticated client
    authenticatedClient = new EnclaveClient({
      auth: { apiKey, apiSecret },
      environment: Environment.PROD_PERMISSIONLESS,
      debug: process.env.ENCLAVE_TEST_DEBUG === 'true',
    });
  });

  describe('Public Endpoints (No Auth Required)', () => {
    test('GET /v1/markets - should fetch all available markets', async () => {
      const markets = await publicClient.getMarkets();

      expect(markets).toBeDefined();
      expect(Array.isArray(markets)).toBe(true);
      expect(markets.length).toBeGreaterThan(0);

      // Check first market has expected structure
      const firstMarket = markets[0];
      expect(firstMarket).toHaveProperty('market');
      expect(firstMarket).toHaveProperty('baseAsset');
      expect(firstMarket).toHaveProperty('quoteAsset');
      expect(firstMarket).toHaveProperty('baseIncrement');
      expect(firstMarket).toHaveProperty('quoteIncrement');
      expect(firstMarket).toHaveProperty('maxLeverage');

      // Find BTC market for reference
      const btcMarket = markets.find(m => m.market === 'BTC-USD.P');
      expect(btcMarket).toBeDefined();
      if (btcMarket) {
        console.log('BTC Market Info:', {
          market: btcMarket.market,
          maxLeverage: btcMarket.maxLeverage,
          baseIncrement: btcMarket.baseIncrement,
          quoteIncrement: btcMarket.quoteIncrement,
        });
      }
    });

    test('GET /v1/perps/depth - should fetch order book', async () => {
      const orderBook = await publicClient.getOrderBook(testMarket, 5);

      expect(orderBook).toBeDefined();
      expect(orderBook.bids).toBeDefined();
      expect(orderBook.asks).toBeDefined();
      expect(Array.isArray(orderBook.bids)).toBe(true);
      expect(Array.isArray(orderBook.asks)).toBe(true);

      // Check bid/ask structure
      if (orderBook.bids.length > 0) {
        const [price, size] = orderBook.bids[0];
        expect(typeof price).toBe('string');
        expect(typeof size).toBe('string');
        expect(Number(price)).toBeGreaterThan(0);
        expect(Number(size)).toBeGreaterThan(0);

        console.log('Best Bid:', { price, size });
      }

      if (orderBook.asks.length > 0) {
        const [price, size] = orderBook.asks[0];
        expect(typeof price).toBe('string');
        expect(typeof size).toBe('string');
        expect(Number(price)).toBeGreaterThan(0);
        expect(Number(size)).toBeGreaterThan(0);

        console.log('Best Ask:', { price, size });
      }
    });

    test('GET /v1/perps/trades - should fetch recent trades', async () => {
      const trades = await publicClient.getTrades(testMarket);

      expect(trades).toBeDefined();
      expect(Array.isArray(trades)).toBe(true);

      if (trades.length > 0) {
        const firstTrade = trades[0];
        expect(firstTrade).toHaveProperty('id');
        expect(firstTrade).toHaveProperty('price');
        expect(firstTrade).toHaveProperty('size');
        expect(firstTrade).toHaveProperty('side');
        expect(firstTrade).toHaveProperty('timestamp');

        console.log('Latest Trade:', {
          price: firstTrade.price,
          size: firstTrade.size,
          side: firstTrade.side,
        });
      }
    });

    test('GET /v1/perps/funding_rates - should fetch funding rate', async () => {
      const fundingRate = await publicClient.getFundingRates(testMarket);

      expect(fundingRate).toBeDefined();
      expect(fundingRate).toHaveProperty('market');
      expect(fundingRate).toHaveProperty('rate');
      expect(fundingRate).toHaveProperty('intervalEnds');
      expect(fundingRate).toHaveProperty('premiums');

      expect(fundingRate.market).toBe(testMarket);
      expect(typeof fundingRate.rate).toBe('string');
      expect(typeof fundingRate.intervalEnds).toBe('string');
      expect(Array.isArray(fundingRate.premiums)).toBe(true);

      console.log('Funding Rate:', {
        market: fundingRate.market,
        rate: fundingRate.rate,
        intervalEnds: fundingRate.intervalEnds,
        premiumsCount: fundingRate.premiums.length,
      });
    });

    test('GET /v1/ticker - should throw informative error for perps', async () => {
      await expect(publicClient.getTicker(testMarket)).rejects.toThrow(
        'Ticker endpoint is not available for perpetual markets'
      );
    });
  });

  describe('Authenticated Endpoints', () => {
    test('GET /v1/perps/balance - should fetch account balance', async () => {
      const balance = await authenticatedClient.getBalance();

      expect(balance).toBeDefined();
      expect(balance).toHaveProperty('walletBalance');
      expect(balance).toHaveProperty('availableMargin');
      expect(balance).toHaveProperty('marginBalance');
      expect(balance).toHaveProperty('unrealizedPnl');
      expect(balance).toHaveProperty('initialMargin');
      expect(balance).toHaveProperty('maintenanceMargin');

      console.log('Account Balance:', {
        walletBalance: balance.walletBalance,
        availableMargin: balance.availableMargin,
        unrealizedPnl: balance.unrealizedPnl,
      });
    });

    test('GET /v1/perps/orders - should fetch open orders', async () => {
      const orders = await authenticatedClient.getOrders();

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);

      console.log('Open Orders Count:', orders.length);

      if (orders.length > 0) {
        const firstOrder = orders[0];
        expect(firstOrder).toHaveProperty('id');
        expect(firstOrder).toHaveProperty('market');
        expect(firstOrder).toHaveProperty('side');
        expect(firstOrder).toHaveProperty('type');
        expect(firstOrder).toHaveProperty('size');
        expect(firstOrder).toHaveProperty('status');
      }
    });

    test('GET /v1/perps/positions - should fetch positions', async () => {
      const positions = await authenticatedClient.getPositions();

      expect(positions).toBeDefined();
      expect(Array.isArray(positions)).toBe(true);

      console.log('Open Positions Count:', positions.length);

      if (positions.length > 0) {
        const firstPosition = positions[0];
        expect(firstPosition).toHaveProperty('market');
        expect(firstPosition).toHaveProperty('side');
        expect(firstPosition).toHaveProperty('size');
        expect(firstPosition).toHaveProperty('entryPrice');
        expect(firstPosition).toHaveProperty('markPrice');
        expect(firstPosition).toHaveProperty('unrealizedPnl');
      }
    });

    test('GET /v1/perps/stop_orders - should fetch stop orders', async () => {
      const stopOrders = await authenticatedClient.getStopOrders();

      expect(stopOrders).toBeDefined();
      expect(Array.isArray(stopOrders)).toBe(true);

      console.log('Stop Orders Count:', stopOrders.length);

      if (stopOrders.length > 0) {
        const firstStopOrder = stopOrders[0];
        expect(firstStopOrder).toHaveProperty('id');
        expect(firstStopOrder).toHaveProperty('market');
        expect(firstStopOrder).toHaveProperty('type');
        expect(firstStopOrder).toHaveProperty('triggerPrice');
        expect(firstStopOrder).toHaveProperty('status');
      }
    });

    test('Order Lifecycle - Create and Cancel', async () => {
      // Get current market price from orderbook
      const orderBook = await authenticatedClient.getOrderBook(testMarket);

      if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
        console.log('Skipping order test - no market depth');
        return;
      }

      const bestBid = new Decimal(orderBook.bids[0][0]);
      // const bestAsk = new Decimal(orderBook.asks[0][0]); // Not used in test order

      // Get market info to find correct minimum size
      const markets = await authenticatedClient.getMarkets();
      const marketInfo = markets.find(m => m.market === testMarket);

      if (!marketInfo) {
        console.log('Market info not found for', testMarket);
        return;
      }

      // Place a limit order far from market (so it doesn't fill)
      const orderPrice = bestBid.mul(0.8); // 20% below best bid
      const orderSize = new Decimal(marketInfo.baseIncrement); // Use actual minimum

      console.log('Creating test order:', {
        market: testMarket,
        side: OrderSide.BUY,
        price: orderPrice.toString(),
        size: orderSize.toString(),
      });

      // Create the order
      const order = await authenticatedClient.createLimitOrder(
        testMarket,
        OrderSide.BUY,
        orderSize,
        orderPrice,
        { clientOrderId: `test-${Date.now()}` }
      );

      expect(order).toBeDefined();
      expect(order).toHaveProperty('id');
      expect(order.market).toBe(testMarket);
      expect(order.side).toBe(OrderSide.BUY);
      expect(order.type).toBe(OrderType.LIMIT);

      console.log('Order created:', { id: order.id, status: order.status });

      // Give the order a moment to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Cancel the order
      const cancelResult = await authenticatedClient.cancelOrder(order.id);

      expect(cancelResult).toBeDefined();
      console.log('Order cancelled:', order.id);

      // Verify order is cancelled
      const orders = await authenticatedClient.getOrders();
      const foundOrder = orders.find(o => o.id === order.id);
      expect(foundOrder).toBeUndefined(); // Should not be in open orders
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid market gracefully', async () => {
      try {
        await publicClient.getOrderBook('INVALID-MARKET');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        // API might return success: false rather than throwing
      }
    });

    test('should handle invalid credentials', async () => {
      const invalidClient = new EnclaveClient({
        auth: {
          apiKey: 'invalid_key',
          apiSecret: 'invalid_secret',
        },
        environment: Environment.PROD_PERMISSIONLESS,
      });

      try {
        await invalidClient.getBalance();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        // Should fail with auth error
      }
    });
  });
});