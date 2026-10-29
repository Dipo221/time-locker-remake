import type { Pool, Poolable } from '../../core/pool';
import type { Faction, Projectile } from '../entities/Projectile';
import type { RuntimeEmitter } from './types';

/**
 * The single place projectiles are born, for the player and for enemies alike.
 *
 * ANGLE CONVENTION, which is easy to get subtly wrong:
 *   - An emitter's angles are RELATIVE, 0 = forward, positive = clockwise.
 *   - `baseAngle` is the absolute direction "forward" means right now, as a
 *     standard atan2 angle. The player's is always +Y (up). An enemy's is its
 *     heading, or the bearing to the player when it aims.
 *   - A shot therefore travels along `baseAngle - emitterAngle`.
 *   - Shapes are authored facing +Y, so the draw rotation is that minus a
 *     quarter turn.
 *
 * Checks out at the two ends: the player with baseAngle = PI/2 and emitter
 * angle 0 fires straight up; a BACK SHOOTER's 180 fires straight down.
 */
export function emit(
  pool: Pool<Projectile>,
  e: RuntimeEmitter,
  x: number,
  y: number,
  baseAngle: number,
  faction: Faction,
  owner: Poolable | null,
): void {
  for (let ai = 0; ai < e.anglesRad.length; ai++) {
    const base = e.anglesRad[ai];

    for (let b = 0; b < e.burst; b++) {
      // Fan the burst across the spread, centred on the base angle.
      const t = e.burst === 1 ? 0 : b / (e.burst - 1) - 0.5;
      const dir = baseAngle - (base + t * e.spreadRad);

      const p = pool.spawn();
      // Projectiles fail soft: skip the shot and let the overlay's miss
      // counter report it, rather than stalling the frame.
      if (p === null) return;

      const dx = Math.cos(dir);
      const dy = Math.sin(dir);

      p.x = x + dx * e.muzzleY;
      p.y = y + dy * e.muzzleY;
      p.vx = dx * e.speed;
      p.vy = dy * e.speed;
      p.angle = dir - Math.PI / 2;
      p.radius = e.size * 0.42;
      p.size = e.size;
      p.damage = e.damage;
      p.life = e.lifetime;
      p.faction = faction;
      p.shape = e.shape;
      p.maxHits = e.maxHits;
      p.hits = 0;
      // Generational, because the shooter may be recycled before its bullet
      // lands and we must not then exempt whatever reused the slot.
      p.ownerRef = owner;
      p.ownerGen = owner === null ? -1 : owner.gen;
      p.behaviours = e.behaviours;
      p.bs.fill(0);
      p.targetRef = null;
      p.targetGen = -1;
      p.hitsFlying = e.hitsFlying;
      p.family = e.family;
    }
  }
}
