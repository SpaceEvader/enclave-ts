/**
 * Adapter functions to convert API responses to clean types
 */

import { Market, Trade, OrderBook, OrderSide } from '../types';
import { ApiPerpsMarket, ApiTrade, ApiOrderBook, ApiMarketsResponse } from '../types/api-responses';

/**
 * Converts API perps market to clean Market type
 */
export function adaptPerpsMarket(apiMarket: ApiPerpsMarket): Market {
  // Get the first margin bracket (most common case)
  const marginInfo = apiMarket.marginInfo[0] || {
    maxLeverage: '1',
    maintenanceMarginRate: '1',
  };

  return {
    market: apiMarket.market,
    baseAsset: apiMarket.pair.base,
    quoteAsset: apiMarket.pair.quote,
    baseIncrement: apiMarket.baseIncrement,
    quoteIncrement: apiMarket.quoteIncrement,
    minOrderSize: apiMarket.baseIncrement, // Use base increment as minimum
    maxOrderSize: apiMarket.maxPositionBaseSize,
    maxLeverage: Number(marginInfo.maxLeverage),
    initialMargin: String(1 / Number(marginInfo.maxLeverage)), // Calculate from leverage
    maintenanceMargin: marginInfo.maintenanceMarginRate,
    maxPositionSize: apiMarket.maxPositionBaseSize,
    makerFee: apiMarket.makerFee,
    takerFee: apiMarket.takerFee,
    fundingRate: apiMarket.dailyInterestRate,
    // Optional fields not in API response
    nextFundingTime: undefined,
    openInterest: undefined,
    volume24h: undefined,
  };
}

/**
 * Converts API markets response to array of Market types
 */
export function adaptMarketsResponse(apiResponse: ApiMarketsResponse): Market[] {
  // For now, only return perps markets
  return apiResponse.perps.tradingPairs.map(adaptPerpsMarket);
}

/**
 * Converts API trade to clean Trade type
 */
export function adaptTrade(apiTrade: ApiTrade): Trade {
  return {
    id: apiTrade.id,
    market: apiTrade.market,
    side: apiTrade.aggressor_side as OrderSide,
    price: apiTrade.price,
    size: apiTrade.size,
    fee: '0', // Not provided in public trade data
    timestamp: new Date(apiTrade.time).getTime(),
    orderId: '', // Not provided in public trade data
    maker: false, // Aggressor is always taker
  };
}

/**
 * Converts API order book to clean OrderBook type
 */
export function adaptOrderBook(apiOrderBook: ApiOrderBook): OrderBook {
  return {
    market: apiOrderBook.market,
    bids: apiOrderBook.bids,
    asks: apiOrderBook.asks,
    timestamp: new Date(apiOrderBook.time).getTime(),
  };
}
