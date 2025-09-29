/**
 * WebSocket Streaming Example for Enclave Markets
 *
 * This example demonstrates real-time data streaming using WebSockets
 * with the Enclave Markets TypeScript client.
 *
 * To get started:
 * 1. Install the package: npm install enclave-ts
 * 2. Sign up at https://enclave.trade?ref=spaced
 * 3. Generate API credentials from the dashboard (for private channels)
 * 4. Run this example to see real-time market data
 */

// When using npm package:
// import { EnclaveClient, Environment, WebSocketChannel } from 'enclave-ts';
// For local development:
import { EnclaveClient, Environment, WebSocketChannel } from '../../src';

async function streamPublicData() {
  console.log('🚀 Starting WebSocket streaming example...\n');

  // Initialize client (no auth needed for public data)
  const client = new EnclaveClient({
    environment: Environment.PROD_PERMISSIONLESS,
    debug: false, // Set to true to see WebSocket debug messages
  });

  try {
    // Connect to WebSocket
    console.log('Connecting to WebSocket...');
    await client.connectWebSocket();
    console.log('✅ Connected!\n');

    // Subscribe to real-time trades
    console.log('Subscribing to BTC-USD.P trades...');
    client.subscribeTrades('BTC-USD.P', (trade) => {
      console.log(`📊 Trade: ${trade.size} BTC @ $${trade.price} (${trade.aggressor_side})`);
    });

    // Subscribe to order book updates
    console.log('Subscribing to BTC-USD.P order book...\n');
    client.subscribeOrderBook('BTC-USD.P', (book) => {
      const bestBid = book.bids?.[0];
      const bestAsk = book.asks?.[0];
      if (bestBid && bestAsk) {
        console.log(
          `📈 Order Book: Bid ${bestBid[1]} @ $${bestBid[0]} | Ask ${bestAsk[1]} @ $${bestAsk[0]}`,
        );
      }
    });

    // Keep streaming for 30 seconds
    console.log('\nStreaming data for 30 seconds...\n');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Cleanup
    console.log('\n🛑 Stopping stream...');
    client.unsubscribeTrades('BTC-USD.P');
    client.unsubscribeOrderBook('BTC-USD.P');
    client.disconnectWebSocket();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error);
    client.disconnectWebSocket();
  }
}

async function streamPrivateData() {
  console.log('🔒 Starting authenticated WebSocket example...\n');

  // Initialize client with authentication
  const client = new EnclaveClient({
    environment: Environment.PROD_PERMISSIONLESS,
    auth: {
      apiKey: process.env.ENCLAVE_API_KEY!,
      apiSecret: process.env.ENCLAVE_API_SECRET!,
    },
    debug: false,
  });

  try {
    // Connect to WebSocket
    console.log('Connecting to WebSocket with authentication...');
    await client.connectWebSocket();
    console.log('✅ Connected and authenticated!\n');

    // Subscribe to your orders
    console.log('Subscribing to order updates...');
    client.subscribeOrders((order) => {
      console.log(`📝 Order Update:`, {
        id: order.id,
        market: order.market,
        side: order.side,
        size: order.size,
        price: order.price,
        status: order.status,
      });
    });

    // Subscribe to position updates
    console.log('Subscribing to position updates...\n');
    client.subscribePositions((position) => {
      console.log(`💼 Position Update:`, {
        market: position.market,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        markPrice: position.markPrice,
        unrealizedPnl: position.unrealizedPnl,
      });
    });

    // Keep streaming for 60 seconds
    console.log('Streaming private data for 60 seconds...\n');
    console.log('(Place or cancel orders to see updates)\n');
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // Cleanup
    console.log('\n🛑 Stopping stream...');
    client.unsubscribeOrders();
    client.unsubscribePositions();
    client.disconnectWebSocket();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error);
    client.disconnectWebSocket();
  }
}

// Usage examples
async function main() {
  console.log('Choose an example to run:\n');
  console.log('1. Public data streaming (no auth required)');
  console.log('2. Private data streaming (requires API credentials)\n');

  const choice = process.argv[2];

  switch (choice) {
    case '1':
    case 'public':
      await streamPublicData();
      break;
    case '2':
    case 'private':
      if (!process.env.ENCLAVE_API_KEY || !process.env.ENCLAVE_API_SECRET) {
        console.error('❌ Please set ENCLAVE_API_KEY and ENCLAVE_API_SECRET environment variables');
        process.exit(1);
      }
      await streamPrivateData();
      break;
    default:
      console.log('Run with: npm run example:websocket public');
      console.log('     or: npm run example:websocket private');
      process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

main().catch(console.error);