import { dist2 } from '../../core/math';
import { runBehaviourHits } from '../behaviours';
import { bodyDist2 } from './enemySystem';
import type { Projectile } from '../entities/Projectile';
import type { World } from '../World';
import { damageEnemy, killPlayer } from './damage';
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
  const enemies = w.enemies;

  // ---- player shots vs enemies --------------------------------------------
  const shots = w.playerShots;
  for (let i = 0; i < shots.count; i++) {
    const s = shots.active[i];
    if (!s.alive) continue;

    for (let j = 0; j < enemies.count; j++) {
      const e = enemies.active[j];
      if (!e.alive) continue;
      // Air units are out of reach of anything that does not home onto them.
      if (e.flying && !s.hitsFlying) continue;

      const r = s.radius + e.hitboxRadius;
      if (bodyDist2(e, s.x, s.y) > r * r) continue;

      // Damage first, then behaviours add their effects (freeze, blast) and
      // may veto the shot's survival. ICE CANON does zero damage, so this is
      // a no-op for it and the freeze below does all the work.
      damageEnemy(w, e, s.damage);
      s.hits++;
      burst(w.particles, w.rng, s.x, s.y, 3, 120, e.colorRole);

      if (runBehaviourHits(s, e, w) === 'destroy') {
        s.alive = false;
        break;
      }
      if (s.hits >= s.maxHits) {
        s.alive = false;
        break;
      }
    }
  }

  // ---- enemy shots vs enemies (friendly fire) -----------------------------
  // Straight from the original: enemy bullets damage other enemies. Because
  // both factions share one projectile type and one pool, this is a handful of
  // lines rather than a feature - and it rewards the player for positioning so
  // a turret's line of fire crosses the crowd chasing them.
  const eshots = w.enemyShots;
  for (let i = 0; i < eshots.count; i++) {
    const s = eshots.active[i];
    if (!s.alive) continue;

    for (let j = 0; j < enemies.count; j++) {
      const e = enemies.active[j];
      if (!e.alive) continue;
      // A shooter cannot hit itself. Generational, so a recycled slot does not
      // inherit the exemption.
      if (s.ownerRef === e && s.ownerGen === e.gen) continue;
      // Ground fire does not reach the air - which is also what lets a
      // helicopter's bombs fall through it onto whatever is underneath.
      if (e.flying) continue;

      const r = s.radius + e.hitboxRadius;
      if (bodyDist2(e, s.x, s.y) > r * r) continue;

      damageEnemy(w, e, s.damage);
      burst(w.particles, w.rng, s.x, s.y, 3, 120, e.colorRole);
      s.alive = false;
      break;
    }
  }

  if (!p.alive || w.phase !== 'playing') return;
  const invuln = p.invulnRealFor > 0;

  // ---- enemy shots vs player ----------------------------------------------
  if (!invuln) {
    for (let i = 0; i < eshots.count; i++) {
      const s: Projectile = eshots.active[i];
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
      // The source is explicit that a helicopter's own hitbox is only its
      // bomb zone and that directly beneath it is safe: the body itself is
      // overhead and cannot touch you.
      if (e.flying) continue;
      const r = p.hitboxRadius + e.hitboxRadius;
      if (bodyDist2(e, p.x, p.y) <= r * r) {
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
