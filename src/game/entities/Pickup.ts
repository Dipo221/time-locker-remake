import type { Poolable } from '../../core/pool';
import type { WeaponId } from '../weapons/types';

export type PickupKind = 'weapon' | 'coin';

export interface Pickup extends Poolable {
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which weapon this grants. Null for coins. */
  weapon: WeaponId | null;
  value: number;
  /** Remaining SCALED seconds before it expires. */
  life: number;
  /** Bob animation phase, in scaled seconds. */
  phase: number;
}

export function createPickup(): Pickup {
  return {
    alive: false,
    gen: 0,
    kind: 'coin',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    weapon: null,
    value: 0,
    life: 0,
    phase: 0,
  };
}

export function resetPickup(p: Pickup): void {
  p.kind = 'coin';
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.weapon = null;
  p.value = 0;
  p.life = 0;
  p.phase = 0;
}
