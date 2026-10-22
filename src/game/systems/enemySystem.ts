import type { ScaledDt } from '../../core/clock';
import { TURN_HOMING, VIEW_H, VIEW_W } from '../../config';
import { DEG, clamp, turnToward } from '../../core/math';

/** Bosses hold station at least this far inside the corridor edges. */
const BOSS_EDGE_MARGIN = 70;
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
    //
    // Bosses are exempt, and must be: they do not leave until killed, so
    // letting the darkness eat one would turn "outrun it for a few seconds"
    // into a free skip of the entire fight.
    if (!e.isBoss && e.y <= darknessY) {
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
      case 'orbitPlayer': {
        // Hold station AHEAD of the player, weaving laterally.
        //
        // The obvious implementation - circle the player at a fixed radius -
        // is a trap, and the first version did it. The player is always
        // fleeing upward from the darkness, so a boss that circles spends
        // most of its time BELOW them, where forward-firing weapons cannot
        // reach it. A play-test had one boss survive 99 seconds that way.
        //
        // Stationing above the player instead puts it exactly where their
        // guns point, and makes it block the escape route: the boss presses
        // down while the darkness pushes up. That squeeze is the fight, and
        // going around it laterally is the out.
        e.phase += dt;
        const R = e.def.orbitRadius ?? 180;
        const weave = Math.sin(e.phase * 0.8) * R * 0.55;

        // Keep the station inside the corridor. Unclamped, the weave can carry
        // a boss past the screen edge, where it is safe from fire while still
        // pressing the player - sheltering off-screen is not a boss mechanic.
        const stationX = clamp(player.x + weave, BOSS_EDGE_MARGIN, VIEW_W - BOSS_EDGE_MARGIN);

        const dx = stationX - e.x;
        const dy = player.y + R - e.y;
        const d = Math.hypot(dx, dy) || 1;

        // Ease off near the station point so it settles instead of jittering.
        const speed = e.speed * Math.min(1, d / 40);
        e.vx = (dx / d) * speed;
        e.vy = (dy / d) * speed;
        e.heading = Math.atan2(player.y - e.y, player.x - e.x);
        break;
      }
      case 'charger': {
        // Hold still, then close fast. The telegraphed pause IS the fight:
        // it is the window to reposition, and the thing the time freeze lets
        // the player read before committing.
        e.chargeTimer -= dt;
        const toPlayer = Math.atan2(player.y - e.y, player.x - e.x);

        if (e.charging) {
          if (e.chargeTimer <= 0) {
            e.charging = false;
            e.chargeTimer = e.def.chargeWindup ?? 1;
          }
          // Velocity is locked in for the duration of the dash, so a dash can
          // be dodged by moving across it rather than simply outrunning it.
        } else if (e.chargeTimer <= 0) {
          e.charging = true;
          e.chargeTimer = e.def.chargeDuration ?? 0.7;
          const s = e.def.chargeSpeed ?? e.speed * 4;
          e.vx = Math.cos(toPlayer) * s;
          e.vy = Math.sin(toPlayer) * s;
          e.heading = toPlayer;
        } else {
          // Winding up: creep toward the player and face them.
          e.vx = Math.cos(toPlayer) * e.speed;
          e.vy = Math.sin(toPlayer) * e.speed;
          e.heading = toPlayer;
        }
        break;
      }
      case 'straight':
      case 'drift':
      case 'turret':
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

    // Bosses are never culled for leaving the view - they chase you down.
    if (
      !e.isBoss &&
      (e.y > top ||
        e.y < bottom ||
        e.x < -CULL_MARGIN ||
        e.x > VIEW_W + CULL_MARGIN)
    ) {
      e.alive = false;
    }
  }
}
