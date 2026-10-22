import type { ScaledDt } from '../../core/clock';
import { TURN_HOMING, VIEW_H, VIEW_W } from '../../config';
import { DEG, turnToward } from '../../core/math';
import type { Pool } from '../../core/pool';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

const CULL_MARGIN = 220;

/**
 * Enemy movement, on the SCALED clock, so an enemy freezes mid-turn with
 * everything else.
 *
 * Archetypes map one-to-one onto the original's colour semantics, which is
 * what lets a player read a crowded screen: black goes straight, orange comes
 * for you, purple weaves and is fast.
 */
export function updateEnemies(
  pool: Pool<Enemy>,
  player: Player,
  darknessY: number,
  cameraY: number,
  dt: ScaledDt,
): void {
  const top = cameraY + VIEW_H / 2 + CULL_MARGIN;
  const bottom = cameraY - VIEW_H / 2 - CULL_MARGIN;

  for (let i = 0; i < pool.count; i++) {
    const e = pool.active[i];

    // Enemies swallowed by the darkness die SILENTLY: no score, no drops.
    // Otherwise the darkness becomes a farming tool and the chase stops being
    // a threat and starts being a strategy.
    if (e.y <= darknessY) {
      e.alive = false;
      continue;
    }

    if (dt === 0) continue;

    if (e.frozenFor > 0) {
      e.frozenFor -= dt;
      // Frozen enemies do not move, but they still kill on contact.
      continue;
    }

    switch (e.archetype) {
      case 'homing': {
        const want = Math.atan2(player.y - e.y, player.x - e.x);
        e.heading = turnToward(e.heading, want, TURN_HOMING * DEG * dt);
        e.vx = Math.cos(e.heading) * e.speed;
        e.vy = Math.sin(e.heading) * e.speed;
        break;
      }
      case 'zigzag': {
        e.phase += dt;
        const amp = e.def.zigAmp ?? 100;
        const hz = e.def.zigHz ?? 0.8;
        // Lateral oscillation perpendicular to the heading.
        const lateral = Math.cos(e.phase * hz * Math.PI * 2) * amp;
        e.vx = Math.cos(e.heading) * e.speed - Math.sin(e.heading) * lateral;
        e.vy = Math.sin(e.heading) * e.speed + Math.cos(e.heading) * lateral;
        break;
      }
      case 'straight':
      case 'drift':
      case 'turret':
      case 'orbitPlayer':
      default:
        // Velocity was set at spawn and does not change.
        break;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // Face the direction of travel. Shapes are authored facing +Y, hence the
    // quarter-turn offset.
    if (e.vx !== 0 || e.vy !== 0) {
      e.angle = Math.atan2(e.vy, e.vx) - Math.PI / 2;
    }

    if (
      e.y > top ||
      e.y < bottom ||
      e.x < -CULL_MARGIN ||
      e.x > VIEW_W + CULL_MARGIN
    ) {
      e.alive = false;
    }
  }
}
