# Enclave Markets TypeScript Client

A TypeScript/JavaScript client library for the [Enclave Markets](https://enclave.trade?ref=spaced) perpetual futures DEX API.

> 💡 **New to Enclave?** [Sign up using referral code: spaced](https://enclave.trade?ref=spaced)

## Features

- 🔐 **Secure Authentication**: HMAC-SHA256 request signing
- 📦 **Complete API Coverage**: All endpoints implemented
- 🔄 **Auto-retry Logic**: Built-in exponential backoff
- 📝 **TypeScript Support**: Full type definitions included
- 🧪 **Well Tested**: Comprehensive test suite
- 📚 **Extensive Documentation**: Detailed JSDoc comments and examples

## Installation

```bash
npm install @enclave-markets/client
# or
pnpm add @enclave-markets/client
# or
yarn add @enclave-markets/client
```

## Getting Started with Enclave

### 1. Create an Account

First, you'll need an Enclave account. [Sign up here using referral code: spaced](https://enclave.trade?ref=spaced)

### 2. Get API Credentials

After signing up, generate your API credentials from the Enclave dashboard.

### 3. Quick Start

```typescript
import { EnclaveClient, Environment, OrderSide } from '@enclave-markets/client';
import Decimal from 'decimal.js';

// Initialize the client
const client = new EnclaveClient({
  environment: Environment.PROD_PERMISSIONLESS,
  auth: {
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret'
  }
});

// Get market information
const markets = await client.getMarkets();
const btcMarket = markets.find(m => m.market === 'BTC-USD.P');

// Create a limit order
const order = await client.createLimitOrder(
  'BTC-USD.P',
  OrderSide.BUY,
  new Decimal(0.001),  // size
  new Decimal(50000)   // price
);

// Check positions
const positions = await client.getPositions();

// Get account balance
const balance = await client.getBalance();
console.log(`Available margin: ${balance.availableMargin}`);
```

## API Documentation

### Client Configuration

```typescript
const client = new EnclaveClient({
  // Environment selection
  environment: Environment.PROD_PERMISSIONLESS, // or PROD, SANDBOX, SANDBOX_PERMISSIONLESS

  // Authentication (optional for public endpoints)
  auth: {
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret'
  },

  // Optional settings
  timeout: 30000,      // Request timeout in ms (default: 30000)
  debug: false,        // Enable debug logging (default: false)
  maxRetries: 3,       // Max retry attempts (default: 3)
  retryDelay: 1000     // Base delay between retries in ms (default: 1000)
});
```

### Market Data

```typescript
// Get all markets
const markets = await client.getMarkets();

// Get specific market
const market = await client.getMarket('BTC-USD.P');

// Get order book
const orderBook = await client.getOrderBook('BTC-USD.P', 20);

// Get latest price (ticker not available for perps)
const trades = await client.getTrades('BTC-USD.P', 1);
const latestPrice = trades[0]?.price;

// Get bid/ask from order book
const orderBook = await client.getOrderBook('BTC-USD.P', 1);
const bestBid = orderBook.bids[0]?.[0];
const bestAsk = orderBook.asks[0]?.[0];

// Get recent trades
const recentTrades = await client.getTrades('BTC-USD.P', 100);

// Get funding rate (single market only)
const fundingRate = await client.getFundingRates('BTC-USD.P');
```

### Trading

```typescript
// Create limit order
const limitOrder = await client.createLimitOrder(
  'BTC-USD.P',
  OrderSide.BUY,
  new Decimal(0.001),
  new Decimal(50000),
  {
    postOnly: true,
    clientOrderId: 'my-order-1'
  }
);

// Create market order
const marketOrder = await client.createMarketOrder(
  'BTC-USD.P',
  OrderSide.BUY,
  new Decimal(100)  // $100 USDT for buy, 0.001 BTC for sell
);

// Cancel order
await client.cancelOrder('order-id');

// Cancel all orders
await client.cancelAllOrders('BTC-USD.P');

// Get open orders
const orders = await client.getOrders();
```

### Position Management

```typescript
// Get all positions
const positions = await client.getPositions();

// Get position for specific market
const btcPositions = await client.getPositions('BTC-USD.P');

// Create stop loss
const stopLoss = await client.createStopOrder(
  'BTC-USD.P',
  PositionDirection.LONG,
  StopOrderType.STOP_LOSS,
  new Decimal(45000)
);

// Create take profit
const takeProfit = await client.createStopOrder(
  'BTC-USD.P',
  PositionDirection.LONG,
  StopOrderType.TAKE_PROFIT,
  new Decimal(55000)
);

// Get stop orders
const stopOrders = await client.getStopOrders();

// Cancel stop order
await client.cancelStopOrder('stop-order-id');
```

### Account

```typescript
// Get account balance
const balance = await client.getBalance();
console.log(`Total balance: ${balance.total}`);
console.log(`Available margin: ${balance.availableMargin}`);
console.log(`Unrealized PnL: ${balance.unrealizedPnl}`);
```

### WebSocket Streaming (v0.4.0+)

Real-time data streaming is now supported via WebSocket:

```typescript
// Connect to WebSocket
await client.connectWebSocket();

// Subscribe to real-time trades
client.subscribeTrades('BTC-USD.P', (trade) => {
  console.log(`Trade: ${trade.size} @ ${trade.price}`);
});

// Subscribe to order book updates
client.subscribeOrderBook('BTC-USD.P', (book) => {
  console.log(`Best bid: ${book.bids[0][0]}, Best ask: ${book.asks[0][0]}`);
});

// Subscribe to your orders (requires auth)
client.subscribeOrders((order) => {
  console.log(`Order ${order.id}: ${order.status}`);
});

// Subscribe to position updates (requires auth)
client.subscribePositions((position) => {
  console.log(`Position ${position.market}: ${position.size}`);
});

// Unsubscribe when done
client.unsubscribeTrades('BTC-USD.P');

// Disconnect WebSocket
client.disconnectWebSocket();
```

## Environments

The client supports multiple environments:

- `PROD` - Production environment (KYC required)
- `PROD_PERMISSIONLESS` - Production permissionless
- `SANDBOX` - Sandbox environment for testing (KYC required)
- `SANDBOX_PERMISSIONLESS` - Sandbox permissionless

## Error Handling

The client includes comprehensive error handling:

```typescript
try {
  const order = await client.createLimitOrder(...);
} catch (error) {
  if (error.code === 'INSUFFICIENT_MARGIN') {
    console.log('Not enough margin for this order');
  } else if (error.code === 'INVALID_MARKET') {
    console.log('Market does not exist');
  }
  // Handle other errors
}
```

## Rate Limiting

The client automatically handles rate limiting with exponential backoff. If you receive a 429 response, the client will retry the request automatically up to the configured maximum retries.

## Development

```bash
# Install dependencies
pnpm install

# Run unit tests only
pnpm test

# Run integration tests (requires API credentials - see below)
pnpm test:integration

# Run all tests
pnpm test:all

# Build
pnpm build

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Running Integration Tests

Integration tests make real API calls and require valid test credentials:

1. Copy the environment template:
   ```bash
   cp .env.test.example .env.test
   ```

2. Add your test API credentials to `.env.test`:
   ```env
   ENCLAVE_TEST_API_KEY=your_test_api_key
   ENCLAVE_TEST_API_SECRET=your_test_api_secret
   ```

3. Run the integration tests:
   ```bash
   pnpm test:integration
   ```

**Note:** Integration tests will create and cancel real orders (far from market price). Use test/sandbox credentials when possible.

## Known Limitations

### Current Limitations (v0.4.0)

- **No Ticker Endpoint**: The `/v1/ticker` endpoint is only available for spot markets. For perpetuals, use `getLatestPrice()` or `getBidAsk()` helper methods.
- **No Historical OHLCV**: Candlestick/OHLCV data endpoints are not available.
- **Rate Limiting**: No built-in rate limit tracking. Implement your own throttling for production use.
- **WebSocket Channels**: Limited to trades, orderbook, orders, and positions. Market data aggregation channels may be added in future versions.

### Workarounds

```typescript
// Getting current price (since ticker is not available)
const trades = await client.getTrades('BTC-USD.P', 1);
const currentPrice = trades[0]?.price;

// Getting bid/ask spread
const orderBook = await client.getOrderBook('BTC-USD.P', 1);
const spread = {
  bid: orderBook.bids[0]?.[0],
  ask: orderBook.asks[0]?.[0],
  spread: Number(orderBook.asks[0]?.[0]) - Number(orderBook.bids[0]?.[0])
};
```

## Examples

See the [examples directory](./docs/examples) for more detailed usage examples.

## License

MIT

## Support

For issues and feature requests, please [open an issue](https://github.com/SpaceEvader/enclave-ts/issues) on GitHub.