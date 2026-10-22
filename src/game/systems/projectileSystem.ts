import type { ScaledDt } from '../../core/clock';
import { VIEW_H, VIEW_W } from '../../config';
import type { Pool } from '../../core/pool';
import type { Projectile } from '../entities/Projectile';

/** How far outside the view a projectile may travel before being culled. */
const CULL_MARGIN = 120;

/**
 * Integrates projectiles on the SCALED clock, which is what makes bullets hang
 * motionless in mid-air when the player stops - and resume from exactly the
 * same pixel. If a frozen bullet's position drifts even in the third decimal,
 * something is reading the real clock; hunt it immediately, because a 1px/s
 * creep reads as "broken" long before anyone can name it.
 *
 * Integration lives HERE and nowhere else. Later, behaviours (homing, orbit,
 * accelerate) will steer by modifying vx/vy before this runs, so two
 * behaviours can never fight over who advances the position.
 */
export function updateProjectiles(
  pool: Pool<Projectile>,
  cameraY: number,
  dt: ScaledDt,
): void {
  if (dt === 0) return; // frozen: not even a lifetime tick

  const top = cameraY + VIEW_H / 2 + CULL_MARGIN;
  const bottom = cameraY - VIEW_H / 2 - CULL_MARGIN;

  for (let i = 0; i < pool.count; i++) {
    const p = pool.active[i];

    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (
      p.y > top ||
      p.y < bottom ||
      p.x < -CULL_MARGIN ||
      p.x > VIEW_W + CULL_MARGIN
    ) {
      p.alive = false;
    }
  }
}
