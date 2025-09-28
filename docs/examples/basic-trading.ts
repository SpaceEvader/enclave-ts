/**
 * Basic Trading Example for Enclave Markets
 *
 * This example demonstrates how to use the Enclave Markets TypeScript client
 * to interact with the perpetual futures DEX.
 *
 * To get started:
 * 1. Sign up at https://enclave.trade?ref=spaced
 * 2. Generate API credentials from the dashboard
 * 3. Set ENCLAVE_API_KEY and ENCLAVE_API_SECRET environment variables
 */

import { EnclaveClient, Environment, OrderSide, OrderType } from '../../src';
import Decimal from 'decimal.js';

async function main() {
  // Initialize client
  const client = new EnclaveClient({
    environment: Environment.SANDBOX_PERMISSIONLESS,
    auth: {
      apiKey: process.env.ENCLAVE_API_KEY!,
      apiSecret: process.env.ENCLAVE_API_SECRET!,
    },
    debug: true,
  });

  try {
    // 1. Get market information
    console.log('Fetching markets...');
    const markets = await client.getMarkets();
    const btcMarket = markets.find((m) => m.market === 'BTC-USD.P');

    if (!btcMarket) {
      throw new Error('BTC-USD.P market not found');
    }

    console.log(`BTC Market:`, {
      market: btcMarket.market,
      minOrderSize: btcMarket.minOrderSize,
      maxLeverage: btcMarket.maxLeverage,
      baseIncrement: btcMarket.baseIncrement,
      quoteIncrement: btcMarket.quoteIncrement,
    });

    // 2. Check account balance
    console.log('\nChecking balance...');
    const balance = await client.getBalance();
    console.log(`Available margin: ${balance.availableMargin}`);
    console.log(`Total balance: ${balance.total}`);

    // 3. Get current price (ticker not available for perps)
    console.log('\nFetching current price...');
    const orderBook = await client.getOrderBook('BTC-USD.P', 1);
    const bestBid = orderBook.bids[0]?.[0] || '0';
    const bestAsk = orderBook.asks[0]?.[0] || '0';
    console.log(`Current BTC price: Bid ${bestBid}, Ask ${bestAsk}`);

    // 4. Place a limit buy order (below current price)
    console.log('\nPlacing limit buy order...');
    const currentPrice = new Decimal(bestAsk);
    const buyPrice = currentPrice.mul(0.99); // 1% below current price

    // Get market info to find minimum size
    const markets = await client.getMarkets();
    const btcMarket = markets.find(m => m.market === 'BTC-USD.P');
    const minSize = btcMarket?.baseIncrement || '0.0001';
    const buySize = new Decimal(minSize); // Use minimum size

    const buyOrder = await client.createLimitOrder(
      'BTC-USD.P',
      OrderSide.BUY,
      buySize,
      buyPrice,
      {
        postOnly: true, // Ensure we're makers
        clientOrderId: `test-buy-${Date.now()}`,
      }
    );

    console.log(`Buy order placed:`, {
      id: buyOrder.id,
      price: buyOrder.price,
      size: buyOrder.size,
      status: buyOrder.status,
    });

    // 5. Check open orders
    console.log('\nFetching open orders...');
    const openOrders = await client.getOrders();
    console.log(`Open orders: ${openOrders.length}`);
    openOrders.forEach((order) => {
      console.log(`- ${order.side} ${order.size} @ ${order.price} (${order.status})`);
    });

    // 6. Check positions
    console.log('\nChecking positions...');
    const positions = await client.getPositions();
    if (positions.length > 0) {
      positions.forEach((position) => {
        console.log(`Position in ${position.market}:`, {
          side: position.side,
          size: position.size,
          entryPrice: position.entryPrice,
          unrealizedPnl: position.unrealizedPnl,
        });
      });
    } else {
      console.log('No open positions');
    }

    // 7. Cancel the order
    console.log('\nCancelling order...');
    const cancelledOrder = await client.cancelOrder(buyOrder.id);
    console.log(`Order cancelled: ${cancelledOrder.id}`);

    // 8. Get order book
    console.log('\nFetching order book...');
    const orderBook = await client.getOrderBook('BTC-USD.P', 5);
    console.log('Top 5 Bids:');
    orderBook.bids.slice(0, 5).forEach(([price, size]) => {
      console.log(`  ${size} @ ${price}`);
    });
    console.log('Top 5 Asks:');
    orderBook.asks.slice(0, 5).forEach(([price, size]) => {
      console.log(`  ${size} @ ${price}`);
    });

    // 9. Get recent trades
    console.log('\nFetching recent trades...');
    const trades = await client.getTrades('BTC-USD.P', 10);
    console.log(`Last ${trades.length} trades:`);
    trades.forEach((trade) => {
      console.log(`  ${trade.side} ${trade.size} @ ${trade.price}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}