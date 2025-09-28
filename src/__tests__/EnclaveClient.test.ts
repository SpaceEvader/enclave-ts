/* eslint-disable @typescript-eslint/unbound-method */
import { EnclaveClient } from '../client/EnclaveClient';
import { Environment } from '../types';

describe('EnclaveClient', () => {
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

  describe('constructor', () => {
    it('should create client with default config', () => {
      const defaultClient = new EnclaveClient();
      expect(defaultClient).toBeDefined();
    });

    it('should create client with custom config', () => {
      const customClient = new EnclaveClient({
        environment: Environment.PROD,
        timeout: 5000,
        debug: true,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('market methods', () => {
    it('should have getMarkets method', () => {
      expect(client.getMarkets).toBeDefined();
    });

    it('should have getMarket method', () => {
      expect(client.getMarket).toBeDefined();
    });
  });

  describe('order methods', () => {
    it('should have createLimitOrder method', () => {
      expect(client.createLimitOrder).toBeDefined();
    });

    it('should have createMarketOrder method', () => {
      expect(client.createMarketOrder).toBeDefined();
    });

    it('should have cancelOrder method', () => {
      expect(client.cancelOrder).toBeDefined();
    });

    it('should have getOrders method', () => {
      expect(client.getOrders).toBeDefined();
    });
  });

  describe('position methods', () => {
    it('should have getPositions method', () => {
      expect(client.getPositions).toBeDefined();
    });
  });

  describe('stop order methods', () => {
    it('should have createStopOrder method', () => {
      expect(client.createStopOrder).toBeDefined();
    });

    it('should have cancelStopOrder method', () => {
      expect(client.cancelStopOrder).toBeDefined();
    });

    it('should have getStopOrders method', () => {
      expect(client.getStopOrders).toBeDefined();
    });
  });

  describe('balance methods', () => {
    it('should have getBalance method', () => {
      expect(client.getBalance).toBeDefined();
    });
  });

  describe('market data methods', () => {
    it('should have getOrderBook method', () => {
      expect(client.getOrderBook).toBeDefined();
    });

    it('should have getTicker method', () => {
      expect(client.getTicker).toBeDefined();
    });

    it('should have getTrades method', () => {
      expect(client.getTrades).toBeDefined();
    });

    it('should have getFundingRates method', () => {
      expect(client.getFundingRates).toBeDefined();
    });
  });
});
