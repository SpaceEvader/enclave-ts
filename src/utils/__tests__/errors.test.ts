import { EnclaveApiError } from '../errors';

describe('EnclaveApiError', () => {
  it('should create error with full context', () => {
    const error = new EnclaveApiError(
      'Invalid market',
      '/v1/perps/orders',
      'POST',
      400,
      '{"error": "Market BTC-USD.P not found"}',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('EnclaveApiError');
    expect(error.statusCode).toBe(400);
    expect(error.endpoint).toBe('/v1/perps/orders');
    expect(error.method).toBe('POST');
    expect(error.responseBody).toBe('{"error": "Market BTC-USD.P not found"}');
    expect(error.message).toContain('Invalid market');
    expect(error.message).toContain('POST /v1/perps/orders');
    expect(error.message).toContain('Status Code: 400');
  });

  it('should handle missing status code', () => {
    const error = new EnclaveApiError('Network error', '/v1/perps/balance', 'GET');

    expect(error.statusCode).toBeUndefined();
    expect(error.message).toContain('Network error');
    expect(error.message).not.toContain('Status Code:');
  });

  it('should truncate long response bodies', () => {
    const longResponse = 'x'.repeat(300);
    const error = new EnclaveApiError('Error', '/v1/test', 'GET', 500, longResponse);

    expect(error.responseBody).toBe(longResponse);
    expect(error.message).toContain('x'.repeat(200) + '...');
  });

  it('should handle errors without response body', () => {
    const error = new EnclaveApiError(
      'Connection timeout',
      '/v1/perps/positions',
      'GET',
      undefined,
      undefined,
    );

    expect(error.responseBody).toBeUndefined();
    expect(error.message).toContain('Connection timeout');
    expect(error.message).not.toContain('Response:');
  });

  it('should maintain stack trace', () => {
    const error = new EnclaveApiError('Test error', '/v1/test', 'GET');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('EnclaveApiError');
  });
});
