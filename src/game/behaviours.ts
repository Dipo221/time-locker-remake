import type { ScaledDt } from '../core/clock';
import { DEG, turnToward } from '../core/math';
import type { Enemy } from './entities/Enemy';
import type { Projectile } from './entities/Projectile';
import { damageEnemy, explode, freezeEnemy } from './systems/damage';
import type { World } from './World';

/**
 * Composable projectile behaviours.
 *
 * Three rules keep this from degenerating into the usual unmaintainable
 * switch:
 *
 * 1. BEHAVIOURS STEER, THE SYSTEM INTEGRATES. `update` may change vx/vy, but
 *    the single `p.x += p.vx * dt` lives in projectileSystem and runs after
 *    every behaviour. Two behaviours can therefore never fight over who moves
 *    the projectile.
 *
 * 2. HIT RESOLUTION IS ORDERED, FIRST DECISIVE RESULT WINS. Behaviours are
 *    consulted in declaration order; 'pass' means "no opinion". So
 *    [piercing, freezing] reads exactly as it sounds: pierce unless the
 *    budget is spent, applying freeze on the way through.
 *
 * 3. FIXED SCRATCH, ZERO ALLOCATION. Each projectile carries a preallocated
 *    Float64Array plus one target handle, so the whole layer allocates
 *    nothing in the hot path.
 *
 * The registry is an exhaustive mapped type: adding a BehaviourSpec kind
 * without writing its handler is a compile error.
 */

export type BehaviourSpec =
  | {
      kind: 'homing';
      turnRateDeg: number;
      acquireRadius: number;
      retargetSec: number;
    }
  | { kind: 'freezing'; durationSec: number }
  | { kind: 'explodeOnHit'; radius: number; damage: number }
  | { kind: 'accelerate'; accel: number; maxSpeed: number };

/** 'pass' = no opinion; the first consume/destroy ends resolution. */
export type HitResult = 'consume' | 'pass' | 'destroy';

export interface Behaviour<S extends BehaviourSpec> {
  readonly kind: S['kind'];
  update?(p: Projectile, s: S, slot: number, dt: ScaledDt, w: World): void;
  onHit?(p: Projectile, t: Enemy, s: S, slot: number, w: World): HitResult;
}

/** Nearest living enemy within `radius`, or null. */
function nearestEnemy(w: World, x: number, y: number, radius: number): Enemy | null {
  const pool = w.enemies;
  let best: Enemy | null = null;
  let bestD2 = radius * radius;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.active[i];
    if (!e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

const homing: Behaviour<Extract<BehaviourSpec, { kind: 'homing' }>> = {
  kind: 'homing',
  update(p, s, slot, dt, w) {
    // slot scratch [0] = seconds until we look for a better target.
    const i = slot * 2;
    p.bs[i] -= dt;

    // Generational check: the enemy we were chasing may have died and had its
    // pool slot reused by a completely different one.
    let target = p.targetRef as Enemy | null;
    if (
      target === null ||
      !target.alive ||
      target.gen !== p.targetGen ||
      p.bs[i] <= 0
    ) {
      target = nearestEnemy(w, p.x, p.y, s.acquireRadius);
      p.targetRef = target;
      p.targetGen = target === null ? -1 : target.gen;
      p.bs[i] = s.retargetSec;
    }
    if (target === null) return;

    const speed = Math.hypot(p.vx, p.vy) || 1;
    const want = Math.atan2(target.y - p.y, target.x - p.x);
    const cur = Math.atan2(p.vy, p.vx);
    const next = turnToward(cur, want, s.turnRateDeg * DEG * dt);
    p.vx = Math.cos(next) * speed;
    p.vy = Math.sin(next) * speed;
    p.angle = next - Math.PI / 2;
  },
};

const freezing: Behaviour<Extract<BehaviourSpec, { kind: 'freezing' }>> = {
  kind: 'freezing',
  onHit(_p, t, s) {
    freezeEnemy(t, s.durationSec);
    // No opinion on whether the shot survives: ICE CANON deals no damage, so
    // whether it pierces is decided by its pierce budget alone.
    return 'pass';
  },
};

const explodeOnHit: Behaviour<Extract<BehaviourSpec, { kind: 'explodeOnHit' }>> =
  {
    kind: 'explodeOnHit',
    onHit(p, t, s, _slot, w) {
      // The struck enemy already took the direct hit; the blast is extra, and
      // deliberately does not re-hit it at full value.
      explode(w, p.x, p.y, s.radius, s.damage);
      void t;
      return 'destroy';
    },
  };

const accelerate: Behaviour<Extract<BehaviourSpec, { kind: 'accelerate' }>> = {
  kind: 'accelerate',
  update(p, s, _slot, dt) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed <= 0) return;
    const next = Math.min(s.maxSpeed, speed + s.accel * dt);
    const k = next / speed;
    p.vx *= k;
    p.vy *= k;
  },
};

/** Adding a kind without a handler is a compile error. */
export const BEHAVIOURS: {
  [K in BehaviourSpec['kind']]: Behaviour<Extract<BehaviourSpec, { kind: K }>>;
} = {
  homing,
  freezing,
  explodeOnHit,
  accelerate,
};

export function runBehaviourUpdates(
  p: Projectile,
  dt: ScaledDt,
  w: World,
): void {
  const list = p.behaviours;
  if (list === null) return;
  for (let i = 0; i < list.length; i++) {
    const spec = list[i];
    const b = BEHAVIOURS[spec.kind] as Behaviour<BehaviourSpec>;
    b.update?.(p, spec, i, dt, w);
  }
}

/**
 * Returns whether the projectile survives the hit. Damage is applied by the
 * caller first; behaviours then add their effects and may veto survival.
 */
export function runBehaviourHits(
  p: Projectile,
  target: Enemy,
  w: World,
): HitResult {
  const list = p.behaviours;
  if (list === null) return 'pass';
  for (let i = 0; i < list.length; i++) {
    const spec = list[i];
    const b = BEHAVIOURS[spec.kind] as Behaviour<BehaviourSpec>;
    const r = b.onHit?.(p, target, spec, i, w);
    if (r !== undefined && r !== 'pass') return r;
  }
  return 'pass';
}

/** Re-exported so callers do not need a second import for the common case. */
export { damageEnemy };
