# Changelog

All notable changes to the enclave-ts library will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2025-09-29

### Added
- 🎯 **Better Error Handling**: New `EnclaveApiError` class with detailed context
  - Includes endpoint, method, status code, and response body
  - Provides clearer error messages for debugging
- 💰 **Convenience Methods**: Helper methods for common balance operations
  - `getAvailableBalance()`: Returns available margin as Decimal for calculations
  - `hasEnoughMargin(amount)`: Checks if account has sufficient margin for a trade

### Fixed
- 📝 **Documentation**: Corrected all package references from `@enclave-markets/client` to `enclave-ts`

## [0.4.0] - 2025-09-29

### Added
- 🚀 **WebSocket Support**: Full real-time data streaming implementation
  - Subscribe to live trades, orderbook updates, orders, and positions
  - Automatic reconnection with exponential backoff
  - HMAC authentication for private channels
  - Clean integration with main client
- 📚 **Comprehensive Examples**: Added working examples for all major features
  - Basic trading example with order placement
  - WebSocket streaming example for real-time data
  - All examples tested against live API
- 🛠️ **Helper Methods**: Convenient utility methods for common operations
  - `getLatestPrice()`: Get current market price from recent trades
  - `getBidAsk()`: Get best bid/ask spread from orderbook

### Fixed
- 🔧 **API Compatibility**: Complete overhaul for production readiness
  - Fixed all API response wrapper handling
  - Corrected endpoint paths (`/v1/perps/depth` for orderbook)
  - Fixed field mappings for all data types
  - Proper handling of single funding rate objects
- 📦 **NPM Package**: Optimized package for distribution
  - Excluded test files from published package
  - Clean TypeScript build configuration
  - Reduced package size to ~30KB

### Changed
- 📝 **Documentation**: Major documentation improvements
  - Updated all code examples to use correct package name
  - Added Known Limitations section
  - Fixed installation instructions
  - Added npm badges to README

## [0.3.0] - 2025-09-28

### Added
- Integration test suite with real API testing
- Environment configuration for different endpoints
- Retry logic with exponential backoff

### Fixed
- API response format handling (wrapped responses)
- Market data endpoint paths
- Balance field mappings

## [0.2.0] - 2025-09-27

### Added
- GitHub Actions CI/CD pipeline
- ESLint and Prettier configuration
- Unit test coverage

### Changed
- Updated to pnpm package manager
- Strict TypeScript configuration

## [0.1.0] - 2025-09-27

### Added
- Initial TypeScript client implementation
- HMAC-SHA256 authentication
- Core trading endpoints (orders, positions, markets)
- Type definitions for all API responses
- Basic error handling

[0.4.1]: https://github.com/SpaceEvader/enclave-ts/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/SpaceEvader/enclave-ts/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/SpaceEvader/enclave-ts/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SpaceEvader/enclave-ts/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SpaceEvader/enclave-ts/releases/tag/v0.1.0