import { COIN_VALUE, DEATH_PARTICLES } from '../../config';
import { dist2 } from '../../core/math';
import type { World } from '../World';
import type { Enemy } from '../entities/Enemy';
import { burst } from './particleSystem';

/**
 * Brute-force circle tests over explicit layer pairs.
 *
 * The arithmetic justifies it: worst case is roughly 250 player shots against
 * 28 enemies plus the enemy-shot pairs, about 9,500 squared-distance tests, or
 * well under 0.2ms. A broadphase here would be optimising a non-problem, and a
 * spatial hash rebuilt per frame has its own constant cost. If the overlay ever
 * shows collision past COLLISION_MS_BUDGET, the uniform grid goes in behind
 * this same candidate-source call and nothing else changes.
 *
 * Collision reads hitboxRadius, NEVER drawSize. That gap is the primary
 * balance lever across the whole roster.
 */
export function resolveCollisions(w: World): void {
  const p = w.player;

  // ---- player shots vs enemies --------------------------------------------
  const shots = w.playerShots;
  const enemies = w.enemies;
  for (let i = 0; i < shots.count; i++) {
    const s = shots.active[i];
    if (!s.alive) continue;

    for (let j = 0; j < enemies.count; j++) {
      const e = enemies.active[j];
      if (!e.alive) continue;

      const r = s.radius + e.hitboxRadius;
      if (dist2(s.x, s.y, e.x, e.y) > r * r) continue;

      e.hp -= s.damage;
      s.hits++;

      // A small hit spark, so feedback is immediate even on a survivor.
      burst(w.particles, w.rng, s.x, s.y, 3, 120, e.colorRole);

      if (e.hp <= 0) killEnemy(w, e);
      if (s.hits >= s.maxHits) {
        s.alive = false;
        break;
      }
    }
  }

  if (!p.alive || w.phase !== 'playing') return;
  const invuln = p.invulnRealFor > 0;

  // ---- enemy shots vs player ----------------------------------------------
  if (!invuln) {
    const eshots = w.enemyShots;
    for (let i = 0; i < eshots.count; i++) {
      const s = eshots.active[i];
      if (!s.alive) continue;
      const r = s.radius + p.hitboxRadius;
      if (dist2(s.x, s.y, p.x, p.y) <= r * r) {
        s.alive = false;
        killPlayer(w);
        return;
      }
    }
  }

  // ---- enemies vs player ---------------------------------------------------
  // Touching ANY enemy is death, including a frozen one. The original is
  // explicit about the frozen case, and it is the rule players learn hardest.
  if (!invuln) {
    for (let j = 0; j < enemies.count; j++) {
      const e = enemies.active[j];
      if (!e.alive) continue;
      const r = p.hitboxRadius + e.hitboxRadius;
      if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
        killPlayer(w);
        return;
      }
    }
  }

  // ---- pickups vs player ---------------------------------------------------
  const pickups = w.pickups;
  for (let i = 0; i < pickups.count; i++) {
    const k = pickups.active[i];
    if (!k.alive) continue;
    const r = p.hitboxRadius + 22;
    if (dist2(k.x, k.y, p.x, p.y) > r * r) continue;

    k.alive = false;
    if (k.kind === 'coin') {
      w.coins += k.value;
    } else if (k.weapon !== null) {
      w.addWeapon(k.weapon);
    }
  }
}

export function killEnemy(w: World, e: Enemy): void {
  e.alive = false;
  w.score += e.scoreValue;

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

function killPlayer(w: World): void {
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
