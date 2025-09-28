/**
 * Actual API response types from Enclave Markets
 * These are the raw types returned from the API
 */

// Markets API Response
export interface ApiMarketsResponse {
  spot: {
    tradingPairs: ApiSpotMarket[];
  };
  cross: {
    tradingPairs: unknown[];
  };
  perps: {
    tradingPairs: ApiPerpsMarket[];
  };
}

export interface ApiPerpsMarket {
  market: string;
  underlyingMarket: string;
  displayName: string;
  pair: {
    base: string;
    quote: string;
  };
  baseIncrement: string;
  quoteIncrement: string;
  dailyInterestRate: string;
  fundingIntervalDivisions: number;
  interestDampingRange: string;
  fundingRateCap: string;
  marginInfo: Array<{
    positionBracketUsd: string;
    maxLeverage: string;
    maintenanceMarginRate: string;
    maintenanceAmount: string;
  }>;
  defaultLeverage: string;
  maxPositionBaseSize: string;
  makerFee: string;
  takerFee: string;
  impactPriceQuoteSize: string;
  tags: string[];
}

export interface ApiSpotMarket {
  market: string;
  pair: {
    base: string;
    quote: string;
  };
  baseIncrement: string;
  quoteIncrement: string;
  feeDecimal: number;
  disabled?: boolean;
}

// Trade API Response
export interface ApiTrade {
  market: string;
  price: string;
  size: string;
  cost: string;
  aggressor_side: 'buy' | 'sell';
  time: string;
  id: string;
}

// Order Book API Response
export interface ApiOrderBook {
  market: string;
  time: string;
  asks: Array<[string, string]>;
  bids: Array<[string, string]>;
}
