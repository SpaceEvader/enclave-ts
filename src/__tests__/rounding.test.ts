import Decimal from 'decimal.js';
import {
  roundDown,
  roundUp,
  roundToIncrement,
  formatDecimal,
  getDecimalPlaces,
} from '../utils/rounding';

describe('rounding utilities', () => {
  describe('roundDown', () => {
    it('should round down to the nearest increment', () => {
      const result = roundDown(new Decimal('1.23456'), new Decimal('0.01'));
      expect(result.toString()).toBe('1.23');
    });

    it('should handle larger increments', () => {
      const result = roundDown(new Decimal('156.789'), new Decimal('10'));
      expect(result.toString()).toBe('150');
    });

    it('should handle small increments', () => {
      const result = roundDown(new Decimal('0.123456789'), new Decimal('0.00001'));
      expect(result.toString()).toBe('0.12345');
    });

    it('should throw error for zero increment', () => {
      expect(() => roundDown(new Decimal('1'), new Decimal('0'))).toThrow(
        'Increment cannot be zero',
      );
    });
  });

  describe('roundUp', () => {
    it('should round up to the nearest increment', () => {
      const result = roundUp(new Decimal('1.23456'), new Decimal('0.01'));
      expect(result.toString()).toBe('1.24');
    });

    it('should handle exact values', () => {
      const result = roundUp(new Decimal('1.23'), new Decimal('0.01'));
      expect(result.toString()).toBe('1.23');
    });

    it('should handle larger increments', () => {
      const result = roundUp(new Decimal('156.789'), new Decimal('10'));
      expect(result.toString()).toBe('160');
    });

    it('should throw error for zero increment', () => {
      expect(() => roundUp(new Decimal('1'), new Decimal('0'))).toThrow('Increment cannot be zero');
    });
  });

  describe('roundToIncrement', () => {
    it('should round to the nearest increment', () => {
      const result1 = roundToIncrement(new Decimal('1.234'), new Decimal('0.01'));
      expect(result1.toString()).toBe('1.23');

      const result2 = roundToIncrement(new Decimal('1.236'), new Decimal('0.01'));
      expect(result2.toString()).toBe('1.24');
    });

    it('should handle exact midpoint', () => {
      const result = roundToIncrement(new Decimal('1.235'), new Decimal('0.01'));
      expect(result.toString()).toBe('1.24'); // Round half up
    });

    it('should throw error for zero increment', () => {
      expect(() => roundToIncrement(new Decimal('1'), new Decimal('0'))).toThrow(
        'Increment cannot be zero',
      );
    });
  });

  describe('formatDecimal', () => {
    it('should format decimal to fixed places', () => {
      const result = formatDecimal(new Decimal('1.23456'), 2);
      expect(result).toBe('1.23');
    });

    it('should add zeros if needed', () => {
      const result = formatDecimal(new Decimal('1.2'), 3);
      expect(result).toBe('1.200');
    });

    it('should handle zero decimal places', () => {
      const result = formatDecimal(new Decimal('123.456'), 0);
      expect(result).toBe('123');
    });
  });

  describe('getDecimalPlaces', () => {
    it('should count decimal places correctly', () => {
      expect(getDecimalPlaces('0.01')).toBe(2);
      expect(getDecimalPlaces('0.00001')).toBe(5);
      expect(getDecimalPlaces('1')).toBe(0);
      expect(getDecimalPlaces('10')).toBe(0);
      expect(getDecimalPlaces('0.1')).toBe(1);
    });

    it('should handle integer strings', () => {
      expect(getDecimalPlaces('100')).toBe(0);
      expect(getDecimalPlaces('5000')).toBe(0);
    });
  });
});
