import type { ScaledDt } from '../../core/clock';
import type { EnemyDef } from '../../data/enemies';
import type { Enemy } from '../entities/Enemy';
import { compileEmitter } from '../weapons/compile';
import { emit } from '../weapons/fire';
import type { RuntimeEmitter } from '../weapons/types';
import type { World } from '../World';

/**
 * Enemy guns, on the SCALED clock exactly like the player's - so a frozen
 * battlefield really is frozen, enemy fire included.
 *
 * Emitters are compiled once per enemy TYPE and shared; the firing timer lives
 * on each Enemy instead, so the shared emitter's own `cooldown` field is never
 * touched here.
 */
const cache = new Map<string, RuntimeEmitter>();

function emitterFor(def: EnemyDef): RuntimeEmitter | null {
  if (def.weapon === undefined) return null;
  let r = cache.get(def.id);
  if (r === undefined) {
    r = compileEmitter(def.weapon);
    cache.set(def.id, r);
  }
  return r;
}

export function updateEnemyGuns(w: World, dt: ScaledDt): void {
  if (dt === 0) return;

  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.active[i];
    if (!e.alive) continue;
    // Frozen enemies hold their fire along with everything else.
    if (e.frozenFor > 0) continue;

    const em = emitterFor(e.def);
    if (em === null) continue;

    e.fireCooldown -= dt;
    if (e.fireCooldown > 0) continue;
    e.fireCooldown += em.cadence;
    if (e.fireCooldown < 0) e.fireCooldown = em.cadence;

    emit(w.enemyShots, em, e.x, e.y, baseAngleFor(e, w), 1, e);
  }
}

function baseAngleFor(e: Enemy, w: World): number {
  return e.def.aim === 'player'
    ? Math.atan2(w.player.y - e.y, w.player.x - e.x)
    : e.heading;
}
