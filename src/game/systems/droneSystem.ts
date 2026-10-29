import type { ScaledDt } from '../../core/clock';
import { DEG, dist2 } from '../../core/math';
import type { DroneDef } from '../../data/drones';
import { DRONES, DRONE_IDS } from '../../data/drones';
import type { Drone } from '../entities/Drone';
import { applyDroneDef } from '../entities/Drone';
import type { Enemy } from '../entities/Enemy';
import type { World } from '../World';
import { damageEnemy, explode } from './damage';
import { bodyDist2 } from './enemySystem';
import { emit } from '../weapons/fire';
import type { RuntimeEmitter } from '../weapons/types';
import { burst } from './particleSystem';

/**
 * Companions: MINE BOT, GUARD BIT, SUPPORTER.
 *
 * One drone per stack held. The controller reconciles the live population
 * against the loadout every frame, which keeps the rule in one place: pick up
 * another MINE BOT and another mine appears, no matter how it was acquired.
 *
 * Everything here runs on SCALED time, so companions freeze with the rest of
 * the world - a ring of mines hanging motionless around a stopped player is
 * the same effect as frozen bullets, and reads correctly.
 */
export class DroneController {
  /** SCALED seconds until a spent mine of each kind is replaced. */
  private respawn = new Map<string, number>();
  private supporterShot: RuntimeEmitter | null = null;

  reset(): void {
    this.respawn.clear();
  }

  update(w: World, dt: ScaledDt): void {
    if (dt === 0) return;
    this.reconcile(w, dt);

    const pool = w.drones;
    for (let i = 0; i < pool.count; i++) {
      const d = pool.active[i];
      if (!d.alive) continue;
      d.age += dt;
      d.cooldown -= dt;

      switch (d.kind) {
        case 'guard':
          this.updateGuard(w, d, dt);
          break;
        case 'mine':
          this.updateMine(w, d, dt);
          break;
        case 'supporter':
          this.updateSupporter(w, d, dt);
          break;
      }
    }
  }

  /** Spawn or despawn so the live count matches the stacks held. */
  private reconcile(w: World, dt: ScaledDt): void {
    for (const id of DRONE_IDS) {
      const def = DRONES[id];
      const want = w.stacks.get(id) ?? 0;

      let attached = 0;
      let total = 0;
      const pool = w.drones;
      for (let i = 0; i < pool.count; i++) {
        const d = pool.active[i];
        if (!d.alive || d.def.id !== id) continue;
        total++;
        if (!d.launched) attached++;
      }

      if (attached >= want) continue;

      // Mines are consumed when they detonate and come back on a timer; the
      // others are simply missing and should appear at once.
      if (def.respawnSec !== undefined && total >= want) {
        const t = (this.respawn.get(id) ?? def.respawnSec) - dt;
        this.respawn.set(id, t > 0 ? t : def.respawnSec);
        if (t > 0) continue;
      }

      const d = w.drones.spawn();
      if (d === null) continue;
      // Space them evenly around the ring.
      applyDroneDef(d, def, (attached / Math.max(1, want)) * Math.PI * 2);
    }
  }

  private orbit(w: World, d: Drone, dt: ScaledDt): void {
    d.angle += d.def.orbitSpeedDeg * DEG * dt;
    d.x = w.player.x + Math.cos(d.angle) * d.def.orbitRadius;
    d.y = w.player.y + Math.sin(d.angle) * d.def.orbitRadius;
  }

  private nearest(w: World, d: Drone, radius: number): Enemy | null {
    const pool = w.enemies;
    let best: Enemy | null = null;
    let bestD2 = radius * radius;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (!e.alive) continue;
      const dd = dist2(e.x, e.y, d.x, d.y);
      if (dd < bestD2) {
        bestD2 = dd;
        best = e;
      }
    }
    return best;
  }

  /** Never leaves orbit; grinds whatever it brushes. */
  private updateGuard(w: World, d: Drone, dt: ScaledDt): void {
    this.orbit(w, d, dt);
    if (d.cooldown > 0) return;

    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (!e.alive) continue;
      // A bit grinds what it brushes against; it does not reach overhead.
      if (e.flying) continue;
      const r = d.hitboxRadius + e.hitboxRadius;
      if (bodyDist2(e, d.x, d.y) > r * r) continue;
      damageEnemy(w, e, d.damage);
      burst(w.particles, w.rng, d.x, d.y, 2, 90, e.colorRole);
      d.cooldown = d.def.tickSec ?? 0.2;
      return;
    }
  }

  /** Holds station, then peels off to chase and detonate. */
  private updateMine(w: World, d: Drone, dt: ScaledDt): void {
    if (!d.launched) {
      this.orbit(w, d, dt);
      const t = this.nearest(w, d, d.def.seekRadius ?? 180);
      if (t === null) return;
      d.launched = true;
      d.targetRef = t;
      d.targetGen = t.gen;
      return;
    }

    const t = this.liveTarget(d);
    if (t === null) {
      // Target died mid-flight: look for another, or expire harmlessly.
      const next = this.nearest(w, d, d.def.seekRadius ?? 180);
      if (next === null) {
        d.alive = false;
        return;
      }
      d.targetRef = next;
      d.targetGen = next.gen;
      return;
    }

    const dx = t.x - d.x;
    const dy = t.y - d.y;
    const dist = Math.hypot(dx, dy) || 1;
    const sp = d.def.launchSpeed ?? 400;
    d.x += (dx / dist) * sp * dt;
    d.y += (dy / dist) * sp * dt;

    // Seeking companions CAN reach air units - the source names MINE BOT as
    // one of the few things that hits helicopters - through this direct
    // strike; the blast that follows is ground-only like any other.
    const r = d.hitboxRadius + t.hitboxRadius;
    if (bodyDist2(t, d.x, d.y) <= r * r) {
      damageEnemy(w, t, d.damage);
      explode(w, d.x, d.y, d.def.explodeRadius ?? 50, d.def.explodeDamage ?? 2);
      d.alive = false;
    }
  }

  /** Covering fire, then it becomes a guided missile. */
  private updateSupporter(w: World, d: Drone, dt: ScaledDt): void {
    const convertAt = d.def.convertSec ?? 10;

    if (!d.launched && d.age >= convertAt) {
      const t = this.nearest(w, d, d.def.seekRadius ?? 400);
      if (t !== null) {
        d.launched = true;
        d.targetRef = t;
        d.targetGen = t.gen;
      }
    }

    if (d.launched) {
      const t = this.liveTarget(d);
      if (t === null) {
        d.alive = false;
        return;
      }
      const dx = t.x - d.x;
      const dy = t.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = d.def.launchSpeed ?? 500;
      d.x += (dx / dist) * sp * dt;
      d.y += (dy / dist) * sp * dt;

      const rr = d.hitboxRadius + t.hitboxRadius;
      if (bodyDist2(t, d.x, d.y) <= rr * rr) {
        // The direct strike is what reaches an air unit; the blast is ground-only.
        damageEnemy(w, t, d.def.explodeDamage ?? d.damage);
        explode(
          w,
          d.x,
          d.y,
          d.def.explodeRadius ?? 60,
          d.def.explodeDamage ?? 3,
        );
        d.alive = false;
      }
      return;
    }

    this.orbit(w, d, dt);
    if (d.cooldown > 0) return;

    const t = this.nearest(w, d, d.def.seekRadius ?? 400);
    if (t === null) return;
    d.cooldown = d.def.fireCadence ?? 0.5;

    if (this.supporterShot === null) {
      this.supporterShot = supporterEmitter(d.def);
    }
    emit(
      w.playerShots,
      this.supporterShot,
      d.x,
      d.y,
      Math.atan2(t.y - d.y, t.x - d.x),
      0,
      null,
    );
  }

  private liveTarget(d: Drone): Enemy | null {
    const t = d.targetRef as Enemy | null;
    if (t === null || !t.alive || t.gen !== d.targetGen) return null;
    return t;
  }
}

/** The SUPPORTER's covering fire, as an ordinary emitter. */
function supporterEmitter(def: DroneDef): RuntimeEmitter {
  return {
    anglesRad: [0],
    burst: 1,
    spreadRad: 0,
    cadence: def.fireCadence ?? 0.5,
    cooldown: 0,
    muzzleY: 0,
    size: 8,
    speed: 620,
    damage: def.damage,
    lifetime: 1.6,
    maxHits: 1,
    shape: 'bulletLong',
    behaviours: null,
    hitsFlying: false,
    track: 'forward',
    trackRange: 0,
    sweepRad: 0,
    sweepHz: 0,
    sweepPhase: 0,
  };
}
