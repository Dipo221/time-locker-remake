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
  | { kind: 'accelerate'; accel: number; maxSpeed: number }
  /**
   * Pinball: on a hit, carry on to the next enemy rather than stopping. Give
   * the projectile `maxHits` of at least bounces + 1, since the hit budget is
   * what finally ends it.
   */
  | { kind: 'bounce'; bounces: number; seekRadius: number }
  /** On a hit, burst into `count` smaller shots fanned all the way round. */
  | {
      kind: 'splitOnHit';
      count: number;
      speed: number;
      size: number;
      damage: number;
      lifetime: number;
    };

/** 'pass' = no opinion; the first consume/destroy ends resolution. */
export type HitResult = 'consume' | 'pass' | 'destroy';

export interface Behaviour<S extends BehaviourSpec> {
  readonly kind: S['kind'];
  update?(p: Projectile, s: S, slot: number, dt: ScaledDt, w: World): void;
  onHit?(p: Projectile, t: Enemy, s: S, slot: number, w: World): HitResult;
}

/** Nearest living enemy within `radius`, or null. */
function nearestEnemy(
  w: World,
  x: number,
  y: number,
  radius: number,
  exclude: Enemy | null = null,
): Enemy | null {
  const pool = w.enemies;
  let best: Enemy | null = null;
  let bestD2 = radius * radius;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.active[i];
    if (!e.alive || e === exclude) continue;
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

const bounce: Behaviour<Extract<BehaviourSpec, { kind: 'bounce' }>> = {
  kind: 'bounce',
  onHit(p, t, s, slot, w) {
    // slot scratch [0] = bounces used so far.
    const i = slot * 2;
    if (p.bs[i] >= s.bounces) return 'pass';
    p.bs[i] += 1;

    // Step out of the thing we just hit FIRST. Without this the projectile is
    // still overlapping it next frame and "bounces" off the same enemy until
    // its hit budget is gone - a pinball that never leaves the first bumper.
    const ax = p.x - t.x;
    const ay = p.y - t.y;
    const al = Math.hypot(ax, ay) || 1;
    const clear = t.hitboxRadius + p.radius + 2;
    p.x = t.x + (ax / al) * clear;
    p.y = t.y + (ay / al) * clear;

    // Then carry on to the next enemy if there is one, or rebound if not.
    const speed = Math.hypot(p.vx, p.vy) || 1;
    const next = nearestEnemy(w, p.x, p.y, s.seekRadius, t);
    const dir =
      next !== null
        ? Math.atan2(next.y - p.y, next.x - p.x)
        : Math.atan2(ay, ax);
    p.vx = Math.cos(dir) * speed;
    p.vy = Math.sin(dir) * speed;
    p.angle = dir - Math.PI / 2;
    return 'pass';
  },
};

const splitOnHit: Behaviour<Extract<BehaviourSpec, { kind: 'splitOnHit' }>> = {
  kind: 'splitOnHit',
  onHit(p, t, s, _slot, w) {
    // Fragments start just OUTSIDE the target, so none of them immediately
    // re-hits the enemy that triggered the split.
    const start = t.hitboxRadius + s.size * 0.5 + 2;
    // The world's seeded rng, never Math.random: a run must replay exactly
    // from its seed, or a reported bug cannot be reproduced.
    const offset = w.rng.next() * Math.PI * 2;
    for (let k = 0; k < s.count; k++) {
      const a = offset + (k / s.count) * Math.PI * 2;
      const c = w.playerShots.spawn();
      if (c === null) break;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      c.x = t.x + dx * start;
      c.y = t.y + dy * start;
      c.vx = dx * s.speed;
      c.vy = dy * s.speed;
      c.angle = a - Math.PI / 2;
      c.radius = s.size * 0.42;
      c.size = s.size;
      c.damage = s.damage;
      c.life = s.lifetime;
      c.faction = p.faction;
      c.shape = p.shape;
      c.maxHits = 1;
      c.hits = 0;
      c.ownerRef = null;
      c.ownerGen = -1;
      // Fragments carry no behaviours, so a split cannot split again forever.
      c.behaviours = null;
      c.bs.fill(0);
      c.targetRef = null;
      c.targetGen = -1;
      c.hitsFlying = false;
    }
    return 'destroy';
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
  bounce,
  splitOnHit,
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
