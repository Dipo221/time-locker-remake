import type { ScaledDt } from '../../core/clock';
import type { Pool } from '../../core/pool';
import type { Pickup } from '../entities/Pickup';
import type { Player } from '../entities/Player';

/** Within this range a pickup drifts toward the player. */
const MAGNET_RADIUS = 150;
const MAGNET_ACCEL = 900;
const MAX_MAGNET_SPEED = 420;

export function updatePickups(
  pool: Pool<Pickup>,
  player: Player,
  darknessY: number,
  dt: ScaledDt,
): void {
  for (let i = 0; i < pool.count; i++) {
    const k = pool.active[i];
    // Swallowed drops are simply gone.
    if (k.y <= darknessY) {
      k.alive = false;
      continue;
    }
    if (dt === 0) continue;

    k.life -= dt;
    if (k.life <= 0) {
      k.alive = false;
      continue;
    }
    k.phase += dt;

    // A gentle magnet. The original gave no feedback at all when an upgrade
    // dropped, which players complained about; drifting toward you is the
    // cheapest possible "this is for you".
    const dx = player.x - k.x;
    const dy = player.y - k.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < MAGNET_RADIUS * MAGNET_RADIUS && d2 > 1) {
      const d = Math.sqrt(d2);
      const pull = MAGNET_ACCEL * (1 - d / MAGNET_RADIUS) * dt;
      k.vx += (dx / d) * pull;
      k.vy += (dy / d) * pull;
      const sp = Math.hypot(k.vx, k.vy);
      if (sp > MAX_MAGNET_SPEED) {
        k.vx = (k.vx / sp) * MAX_MAGNET_SPEED;
        k.vy = (k.vy / sp) * MAX_MAGNET_SPEED;
      }
    }

    k.x += k.vx * dt;
    k.y += k.vy * dt;
  }
}
