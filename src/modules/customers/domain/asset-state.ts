import { Errors } from '../../../shared/kernel/errors';
import type { AssetStatus } from './types';

const TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  active: ['maintenance', 'retired'],
  maintenance: ['active', 'retired'],
  retired: [],
};

export function assertAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw Errors.invalidState(`Cannot change asset from ${from} to ${to}`);
  }
}
