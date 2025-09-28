import { HmacAuth } from '../client/auth/HmacAuth';
import * as crypto from 'crypto';

describe('HmacAuth', () => {
  let auth: HmacAuth;

  beforeEach(() => {
    auth = new HmacAuth('test-api-key', 'test-api-secret');
  });

  describe('generateAuthHeaders', () => {
    it('should generate valid auth headers', () => {
      const headers = auth.generateAuthHeaders('GET', '/v1/markets', '');

      expect(headers['ENCLAVE-KEY-ID']).toBe('test-api-key');
      expect(headers['ENCLAVE-TIMESTAMP']).toBeDefined();
      expect(headers['ENCLAVE-SIGN']).toBeDefined();
      expect(headers['ENCLAVE-SIGN']).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different signatures for different payloads', () => {
      const headers1 = auth.generateAuthHeaders('GET', '/v1/markets', '');
      const headers2 = auth.generateAuthHeaders('POST', '/v1/orders', '{"test": true}');

      expect(headers1['ENCLAVE-SIGN']).not.toBe(headers2['ENCLAVE-SIGN']);
    });

    it('should include body in signature calculation', () => {
      const body = JSON.stringify({ market: 'BTC-USD.P', side: 'buy' });
      const headers = auth.generateAuthHeaders('POST', '/v1/perps/orders', body);

      expect(headers['ENCLAVE-SIGN']).toBeDefined();
      expect(headers['ENCLAVE-SIGN']).toHaveLength(64);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct webhook signature', () => {
      const timestamp = '1234567890';
      const body = '{"test": "data"}';
      const payload = `${timestamp}${body}`;

      // Generate a valid signature using the same secret
      const validSignature = crypto
        .createHmac('sha256', 'test-api-secret')
        .update(payload)
        .digest('hex');

      const isValid = auth.validateWebhookSignature(validSignature, timestamp, body);
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const timestamp = '1234567890';
      const body = '{"test": "data"}';
      const invalidSignature = 'invalid-signature-here';

      const isValid = auth.validateWebhookSignature(invalidSignature, timestamp, body);
      expect(isValid).toBe(false);
    });
  });
});
