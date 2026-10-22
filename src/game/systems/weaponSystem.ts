import type { ScaledDt } from '../../core/clock';
import type { World } from '../World';
import type { RuntimeEmitter } from '../weapons/types';

/**
 * The player's guns run on the SCALED clock, so a frozen player fires nothing.
 * There is no special case for that anywhere - it falls out of the clock split
 * for free, which is a good sign the architecture is right.
 *
 * Emitter angles are 0 = forward (+Y), positive clockwise. The direction
 * vector is therefore (sin a, cos a), and the draw rotation is -a (rotating a
 * +Y-facing shape by -a aims it along that vector).
 */
export function updatePlayerGuns(w: World, dt: ScaledDt): void {
  if (dt === 0) return;
  const p = w.player;
  if (!p.alive) return;

  const emitters = w.loadout.emitters;
  for (let i = 0; i < emitters.length; i++) {
    const e = emitters[i];
    e.cooldown -= dt;
    if (e.cooldown > 0) continue;
    // Accumulate rather than assign, so a very high rate does not lose volleys.
    e.cooldown += e.cadence;
    if (e.cooldown < 0) e.cooldown = e.cadence;
    fire(w, e);
  }
}

function fire(w: World, e: RuntimeEmitter): void {
  const p = w.player;

  for (let ai = 0; ai < e.anglesRad.length; ai++) {
    const base = e.anglesRad[ai];

    for (let b = 0; b < e.burst; b++) {
      // Fan the burst across the spread, centred on the base angle.
      const t = e.burst === 1 ? 0 : b / (e.burst - 1) - 0.5;
      const a = base + t * e.spreadRad;

      const shot = w.playerShots.spawn();
      // Projectiles fail soft: skip the shot and let the overlay's miss
      // counter report it, rather than stalling the frame.
      if (shot === null) return;

      const sx = Math.sin(a);
      const cy = Math.cos(a);

      shot.x = p.x + sx * e.muzzleY;
      shot.y = p.y + cy * e.muzzleY;
      shot.vx = sx * e.speed;
      shot.vy = cy * e.speed;
      shot.angle = -a;
      shot.radius = e.size * 0.42;
      shot.size = e.size;
      shot.damage = e.damage;
      shot.life = e.lifetime;
      shot.faction = 0;
      shot.shape = e.shape;
      shot.maxHits = e.maxHits;
      shot.hits = 0;
    }
  }
}
