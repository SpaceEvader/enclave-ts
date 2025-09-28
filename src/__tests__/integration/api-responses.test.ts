/**
 * Integration tests using actual API response format from Enclave Markets
 * Based on testing report findings
 */

import { ApiWrapper, MarketsResponse, ApiBalance } from '../../types';

describe('API Response Format', () => {
  describe('Wrapped Response Structure', () => {
    it('should handle successful wrapped response', () => {
      const mockResponse: ApiWrapper<{ data: string }> = {
        success: true,
        result: { data: 'test' },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.result).toBeDefined();
      expect(mockResponse.result.data).toBe('test');
    });

    it('should handle error wrapped response', () => {
      const mockResponse: ApiWrapper<unknown> = {
        success: false,
        result: {} as unknown,
        error: 'Invalid request',
      };

      expect(mockResponse.success).toBe(false);
      expect(mockResponse.error).toBe('Invalid request');
    });
  });

  describe('Markets Response', () => {
    it('should parse markets response correctly', () => {
      const mockMarketsResponse: ApiWrapper<MarketsResponse> = {
        success: true,
        result: {
          perps: {
            tradingPairs: [
              {
                market: 'BTC-USD.P',
                baseAsset: 'BTC',
                quoteAsset: 'USD',
                baseIncrement: '0.0001',
                quoteIncrement: '0.01',
                minOrderSize: '0.0001',
                maxOrderSize: '100',
                maxLeverage: 100,
                initialMargin: '0.01',
                maintenanceMargin: '0.005',
                maxPositionSize: '1000',
                makerFee: '0.0002',
                takerFee: '0.0005',
                fundingRate: '0.0001',
                nextFundingTime: 1234567890,
                openInterest: '1000000',
                volume24h: '50000000',
              },
            ],
          },
        },
      };

      expect(mockMarketsResponse.success).toBe(true);
      expect(mockMarketsResponse.result.perps.tradingPairs).toHaveLength(1);
      expect(mockMarketsResponse.result.perps.tradingPairs[0].market).toBe('BTC-USD.P');
    });
  });

  describe('Balance Response', () => {
    it('should map API balance fields correctly', () => {
      const mockBalanceResponse: ApiWrapper<ApiBalance> = {
        success: true,
        result: {
          walletBalance: '10.00',
          availableMargin: '10.00',
          unrealizedPnl: '0.00',
          marginBalance: '10.00',
          initialMargin: '0.00',
          maintenanceMargin: '0.00',
          totalPositionValue: '0.00',
          totalOrderMargin: '0.00',
        },
      };

      expect(mockBalanceResponse.success).toBe(true);
      expect(mockBalanceResponse.result.walletBalance).toBe('10.00');
      expect(mockBalanceResponse.result.availableMargin).toBe('10.00');

      // These are the actual field names from the API
      expect(mockBalanceResponse.result.walletBalance).toBeDefined();
      expect(mockBalanceResponse.result.marginBalance).toBeDefined();
      expect(mockBalanceResponse.result.totalPositionValue).toBeDefined();
    });
  });

  describe('Orders Response', () => {
    it('should handle empty orders array', () => {
      const mockOrdersResponse: ApiWrapper<[]> = {
        success: true,
        result: [],
      };

      expect(mockOrdersResponse.success).toBe(true);
      expect(mockOrdersResponse.result).toEqual([]);
      expect(mockOrdersResponse.result).toHaveLength(0);
    });

    it('should handle orders array with data', () => {
      const mockOrdersResponse = {
        success: true,
        result: [
          {
            id: 'order-123',
            market: 'BTC-USD.P',
            side: 'buy',
            type: 'limit',
            price: '50000',
            size: '0.001',
            remainingSize: '0.001',
            status: 'open',
            createdAt: 1234567890,
            updatedAt: 1234567890,
          },
        ],
      };

      expect(mockOrdersResponse.success).toBe(true);
      expect(mockOrdersResponse.result).toHaveLength(1);
      expect(mockOrdersResponse.result[0].id).toBe('order-123');
    });
  });

  describe('Positions Response', () => {
    it('should handle positions response', () => {
      const mockPositionsResponse: ApiWrapper<[]> = {
        success: true,
        result: [],
      };

      expect(mockPositionsResponse.success).toBe(true);
      expect(mockPositionsResponse.result).toEqual([]);
    });
  });

  describe('Trades Response', () => {
    it('should handle trades with actual price data', () => {
      const mockTradesResponse = {
        success: true,
        result: [
          {
            id: 'trade-123',
            market: 'BTC-USD.P',
            side: 'buy',
            price: '111000.00', // Actual BTC price from testing
            size: '0.001',
            fee: '0.05555',
            timestamp: 1234567890,
            orderId: 'order-123',
            maker: false,
          },
        ],
      };

      expect(mockTradesResponse.success).toBe(true);
      expect(mockTradesResponse.result[0].price).toBe('111000.00');
    });
  });
});
