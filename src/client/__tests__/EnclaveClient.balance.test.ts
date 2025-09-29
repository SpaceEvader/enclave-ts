import Decimal from 'decimal.js';
import { EnclaveClient } from '../EnclaveClient';
import { Environment } from '../../types';

describe('EnclaveClient - Balance Convenience Methods', () => {
  let client: EnclaveClient;

  beforeEach(() => {
    client = new EnclaveClient({
      environment: Environment.SANDBOX,
      auth: {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
      },
    });
  });

  describe('getAvailableBalance', () => {
    it('should return available margin as Decimal', async () => {
      // Mock the getBalance method
      jest.spyOn(client, 'getBalance').mockResolvedValue({
        asset: 'USDT',
        available: '1000.00',
        locked: '0',
        total: '1000.00',
        inPositions: '0',
        unrealizedPnl: '0',
        marginBalance: '1000.00',
        maintenanceMargin: '0',
        initialMargin: '0',
        availableMargin: '1000.00',
        walletBalance: '1000.00',
        totalPositionValue: '0',
        totalOrderMargin: '0',
      });

      const available = await client.getAvailableBalance();

      expect(available).toBeInstanceOf(Decimal);
      expect(available.toFixed(2)).toBe('1000.00');
    });
  });

  describe('hasEnoughMargin', () => {
    beforeEach(() => {
      jest.spyOn(client, 'getBalance').mockResolvedValue({
        asset: 'USDT',
        available: '1000.00',
        locked: '0',
        total: '1000.00',
        inPositions: '0',
        unrealizedPnl: '0',
        marginBalance: '1000.00',
        maintenanceMargin: '0',
        initialMargin: '0',
        availableMargin: '500.00', // Available margin for testing
        walletBalance: '1000.00',
        totalPositionValue: '0',
        totalOrderMargin: '0',
      });
    });

    it('should return true when margin is sufficient (Decimal input)', async () => {
      const result = await client.hasEnoughMargin(new Decimal(400));
      expect(result).toBe(true);
    });

    it('should return true when margin equals required (number input)', async () => {
      const result = await client.hasEnoughMargin(500);
      expect(result).toBe(true);
    });

    it('should return false when margin is insufficient (string input)', async () => {
      const result = await client.hasEnoughMargin('600.00');
      expect(result).toBe(false);
    });

    it('should handle edge cases correctly', async () => {
      const exactMatch = await client.hasEnoughMargin('500.00');
      expect(exactMatch).toBe(true);

      const slightlyOver = await client.hasEnoughMargin('500.01');
      expect(slightlyOver).toBe(false);
    });
  });
});
