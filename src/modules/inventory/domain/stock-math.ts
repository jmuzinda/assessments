import { Errors } from '../../../shared/kernel/errors';
import type { StockLevel } from './types';

export function availableQuantity(level: Pick<StockLevel, 'onHand' | 'reserved'>): number {
  return level.onHand - level.reserved;
}

export function applyReceive(level: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Errors.validation('quantity must be a positive integer');
  }
  return { ...level, onHand: level.onHand + quantity };
}

export function applyAdjust(level: StockLevel, delta: number): StockLevel {
  if (!Number.isInteger(delta) || delta === 0) {
    throw Errors.validation('delta must be a non-zero integer');
  }
  const onHand = level.onHand + delta;
  if (onHand < 0 || onHand < level.reserved) {
    throw Errors.conflict('Adjustment would drop on-hand stock below reserved quantity');
  }
  return { ...level, onHand };
}

export function applyReserve(level: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Errors.validation('quantity must be a positive integer');
  }
  if (quantity > availableQuantity(level)) {
    throw Errors.insufficientStock('part', availableQuantity(level), quantity);
  }
  return { ...level, reserved: level.reserved + quantity };
}

export function applyRelease(level: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Errors.validation('quantity must be a positive integer');
  }
  if (quantity > level.reserved) {
    throw Errors.conflict('Cannot release more stock than is reserved');
  }
  return { ...level, reserved: level.reserved - quantity };
}

export function applyConsume(level: StockLevel, quantity: number): StockLevel {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw Errors.validation('quantity must be a positive integer');
  }
  const available = availableQuantity(level);
  if (quantity > available) {
    throw Errors.insufficientStock('part', available, quantity);
  }
  return { ...level, onHand: level.onHand - quantity };
}
