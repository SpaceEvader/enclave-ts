/**
 * Enhanced error class for Enclave API errors with additional context
 */
export class EnclaveApiError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint: string;
  public readonly method: string;
  public readonly responseBody?: string;

  constructor(
    message: string,
    endpoint: string,
    method: string,
    statusCode?: number,
    responseBody?: string,
  ) {
    const enhancedMessage =
      `Enclave API Error: ${message}\n` +
      `  Endpoint: ${method} ${endpoint}\n` +
      (statusCode ? `  Status Code: ${statusCode}\n` : '') +
      (responseBody
        ? `  Response: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`
        : '');

    super(enhancedMessage);
    this.name = 'EnclaveApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.method = method;
    this.responseBody = responseBody;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnclaveApiError);
    }
  }
}
