import Decimal from 'decimal.js';

/**
 * Rounds a value down to the nearest increment.
 *
 * @param value - The value to round
 * @param increment - The increment to round to
 * @returns The rounded value
 *
 * @example
 * ```typescript
 * roundDown(new Decimal('1.23456'), new Decimal('0.01')) // 1.23
 * roundDown(new Decimal('1.23456'), new Decimal('0.1')) // 1.2
 * ```
 */
export function roundDown(value: Decimal, increment: Decimal): Decimal {
  if (increment.isZero()) {
    throw new Error('Increment cannot be zero');
  }
  return value.div(increment).floor().mul(increment);
}

/**
 * Rounds a value up to the nearest increment.
 *
 * @param value - The value to round
 * @param increment - The increment to round to
 * @returns The rounded value
 *
 * @example
 * ```typescript
 * roundUp(new Decimal('1.23456'), new Decimal('0.01')) // 1.24
 * roundUp(new Decimal('1.23456'), new Decimal('0.1')) // 1.3
 * ```
 */
export function roundUp(value: Decimal, increment: Decimal): Decimal {
  if (increment.isZero()) {
    throw new Error('Increment cannot be zero');
  }
  return value.div(increment).ceil().mul(increment);
}

/**
 * Rounds a value to the nearest increment.
 *
 * @param value - The value to round
 * @param increment - The increment to round to
 * @returns The rounded value
 *
 * @example
 * ```typescript
 * roundToIncrement(new Decimal('1.23456'), new Decimal('0.01')) // 1.23
 * roundToIncrement(new Decimal('1.23556'), new Decimal('0.01')) // 1.24
 * ```
 */
export function roundToIncrement(value: Decimal, increment: Decimal): Decimal {
  if (increment.isZero()) {
    throw new Error('Increment cannot be zero');
  }
  return value.div(increment).round().mul(increment);
}

/**
 * Formats a decimal value to a string with fixed decimal places.
 *
 * @param value - The value to format
 * @param decimalPlaces - Number of decimal places
 * @returns Formatted string
 */
export function formatDecimal(value: Decimal, decimalPlaces: number): string {
  return value.toFixed(decimalPlaces);
}

/**
 * Calculates the number of decimal places in an increment string.
 *
 * @param increment - The increment as a string (e.g., "0.01")
 * @returns Number of decimal places
 */
export function getDecimalPlaces(increment: string): number {
  const parts = increment.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}
