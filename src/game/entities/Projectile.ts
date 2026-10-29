import type { Poolable } from '../../core/pool';
import type { ShapeId } from '../../data/shapes';
import type { BehaviourSpec } from '../behaviours';
import type { ShotFamily } from '../weapons/types';

/** Scratch numbers per behaviour slot. Fixed, so the pool never allocates. */
export const BEHAVIOUR_SLOTS = 4;


/** 0 = fired by the player, 1 = fired by an enemy. */
export type Faction = 0 | 1;

export interface Projectile extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Render rotation, radians. Kept in sync with velocity for oriented shapes. */
  angle: number;
  /** Hitbox radius. */
  radius: number;
  /** Draw size in world units. */
  size: number;
  damage: number;
  /** Remaining SCALED seconds. */
  life: number;
  faction: Faction;
  shape: ShapeId;
  /** Pierce budget. 1 = dies on first hit; Infinity = JUSTIN. */
  maxHits: number;
  hits: number;
  /**
   * Who fired this, so a shooter cannot hit itself while its own bullets can
   * still hit its neighbours. Generational: the shooter may be recycled before
   * the bullet lands, and we must not then exempt whatever reused the slot.
   */
  ownerRef: Poolable | null;
  ownerGen: number;
  /**
   * Immutable spec list, shared with the emitter that fired this. Null for a
   * plain bullet, which is the common case.
   */
  behaviours: readonly BehaviourSpec[] | null;
  /** Two scratch numbers per behaviour slot. Allocated once, never resized. */
  bs: Float64Array;
  /** Homing target, generational so a recycled slot is not mistaken for it. */
  targetRef: Poolable | null;
  targetGen: number;
  /** Can reach air units. Copied from the emitter; true exactly when it homes. */
  hitsFlying: boolean;
  /** Which colour it wears. Copied from the emitter; see shotFamily. */
  family: ShotFamily;
}

export function createProjectile(): Projectile {
  // Every field initialised here, in a fixed order, so the whole pool shares
  // one hidden class. Never add a field to an instance later.
  return {
    alive: false,
    gen: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 0,
    size: 0,
    damage: 0,
    life: 0,
    faction: 0,
    shape: 'bulletLong',
    maxHits: 1,
    hits: 0,
    ownerRef: null,
    ownerGen: -1,
    behaviours: null,
    bs: new Float64Array(BEHAVIOUR_SLOTS * 2),
    targetRef: null,
    targetGen: -1,
    hitsFlying: false,
    family: 'basic',
  };
}

export function resetProjectile(p: Projectile): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.angle = 0;
  p.radius = 0;
  p.size = 0;
  p.damage = 0;
  p.life = 0;
  p.faction = 0;
  p.shape = 'bulletLong';
  p.maxHits = 1;
  p.hits = 0;
  p.ownerRef = null;
  p.ownerGen = -1;
  p.behaviours = null;
  p.bs.fill(0);
  p.targetRef = null;
  p.targetGen = -1;
  p.hitsFlying = false;
  p.family = 'basic';
}
