import { COIN_VALUE, DEATH_PARTICLES } from '../../config';
import { dist2 } from '../../core/math';
import type { Enemy } from '../entities/Enemy';
import type { World } from '../World';
import { burst } from './particleSystem';

/**
 * Damage application, split out from collisionSystem so that projectile
 * behaviours can deal damage too (an exploding rocket, a freezing shot)
 * without the two modules importing each other.
 */

export function damageEnemy(w: World, e: Enemy, amount: number): void {
  if (!e.alive) return;
  e.hp -= amount;
  if (e.hp <= 0) killEnemy(w, e);
}

/** Freeze on hit. A frozen enemy stops moving and shooting - but still kills. */
export function freezeEnemy(e: Enemy, seconds: number): void {
  if (!e.alive) return;
  // Refresh rather than add, so stacked ice does not bank minutes of freeze.
  if (e.frozenFor < seconds) e.frozenFor = seconds;
}

/** Area damage, for rockets and missiles. */
export function explode(
  w: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
): void {
  const r2 = radius * radius;
  const pool = w.enemies;
  // Iterate backwards: killEnemy only flags, but staying robust to ordering
  // costs nothing here.
  for (let i = pool.count - 1; i >= 0; i--) {
    const e = pool.active[i];
    if (!e.alive) continue;
    if (dist2(x, y, e.x, e.y) > r2) continue;
    damageEnemy(w, e, damage);
  }
  burst(w.particles, w.rng, x, y, 14, 260, 'orange');
}

export function killEnemy(w: World, e: Enemy): void {
  e.alive = false;
  w.score += e.scoreValue;
  // After the score award, so the gap to the next boss is measured from where
  // the player actually stands once the fight is over.
  if (e.isBoss) w.onBossDefeated();

  burst(
    w.particles,
    w.rng,
    e.x,
    e.y,
    Math.min(26, 8 + Math.round(e.drawSize * 0.35)),
    200,
    e.colorRole,
  );

  if (e.drop === 'coin') {
    const k = w.pickups.spawn();
    if (k !== null) {
      k.kind = 'coin';
      k.x = e.x;
      k.y = e.y;
      k.vx = 0;
      k.vy = -20;
      k.weapon = null;
      k.value = COIN_VALUE;
      k.life = 9;
      k.phase = 0;
    }
  } else if (e.drop === 'weapon') {
    const k = w.pickups.spawn();
    if (k !== null) {
      k.kind = 'weapon';
      k.x = e.x;
      k.y = e.y;
      k.vx = 0;
      k.vy = -20;
      k.weapon = w.rollWeapon();
      k.value = 0;
      k.life = 11;
      k.phase = 0;
    }
  }
}

export function killPlayer(w: World): void {
  burst(
    w.particles,
    w.rng,
    w.player.x,
    w.player.y,
    DEATH_PARTICLES,
    320,
    'player',
  );
  w.kill('contact');
}
