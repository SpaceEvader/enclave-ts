import * as crypto from 'crypto';

export interface AuthHeaders {
  'ENCLAVE-KEY-ID': string;
  'ENCLAVE-TIMESTAMP': string;
  'ENCLAVE-SIGN': string;
}

export class HmacAuth {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  /**
   * Generates authentication headers for API requests using HMAC-SHA256.
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param path - Request path including query parameters
   * @param body - Request body as string (empty string for GET requests)
   * @returns Authentication headers required by the API
   */
  public generateAuthHeaders(method: string, path: string, body: string = ''): AuthHeaders {
    const timestamp = Date.now();
    const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
    const signature = crypto.createHmac('sha256', this.apiSecret).update(payload).digest('hex');

    return {
      'ENCLAVE-KEY-ID': this.apiKey,
      'ENCLAVE-TIMESTAMP': timestamp.toString(),
      'ENCLAVE-SIGN': signature,
    };
  }

  /**
   * Validates webhook signatures to ensure authenticity.
   *
   * @param signature - The signature from the webhook headers
   * @param timestamp - The timestamp from the webhook headers
   * @param body - The raw webhook body
   * @returns Whether the signature is valid
   */
  public validateWebhookSignature(signature: string, timestamp: string, body: string): boolean {
    const payload = `${timestamp}${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');

    // Ensure both strings are the same length for timing-safe comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Signs a message for WebSocket authentication.
   *
   * @param message - The message to sign
   * @returns HMAC signature
   */
  public sign(message: string): string {
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
  }

  /**
   * Get the API key (needed for WebSocket auth).
   */
  public getApiKey(): string {
    return this.apiKey;
  }
}
