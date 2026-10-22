import type { ScaledDt } from '../../core/clock';
import {
  BOSS_CATCHUP_MAX,
  BOSS_PURSUE_MARGIN,
  BOSS_CATCHUP_RANGE,
  BOSS_CATCHUP_START,
  TURN_HOMING,
  VIEW_H,
  VIEW_W,
} from '../../config';
import { DEG, clamp, turnToward } from '../../core/math';

/** Bosses hold station at least this far inside the corridor edges. */
const BOSS_EDGE_MARGIN = 70;

/**
 * Speed multiplier for a boss that has fallen behind its station.
 *
 * Bosses do not leave until they are killed, and they are exempt from the
 * offscreen cull for that reason - which means that without catch-up, a player
 * who simply sprints can strand one off-screen forever. That is exactly what
 * happened in play-testing: a T-Rex at 95 u/s was left behind, never
 * despawned, and because the scheduler will not start a new boss while one is
 * alive, the rest of the run had no bosses at all.
 *
 * Despawning instead would have been the easier fix and the wrong one: it
 * makes every boss skippable by anyone willing to run, which deletes the
 * content. So outrunning a boss is a reprieve, not an escape. Sprinting hard
 * enough to stay ahead also drives the time scale up, which means the rest of
 * the world comes at you faster - the escape has a price.
 */
function bossCatchup(d: number): number {
  const over = d - BOSS_CATCHUP_START;
  if (over <= 0) return 1;
  const t = Math.min(1, over / BOSS_CATCHUP_RANGE);
  return 1 + t * (BOSS_CATCHUP_MAX - 1);
}
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

        // Accelerate when far from station so the boss cannot be outrun...
        let speed = e.speed * bossCatchup(d);

        // ...but distance-to-station alone is not enough. A boss merely
        // slower than the player settles just BELOW them, which is outside
        // the forward firing arc, and the fight stalls at a trickle of
        // damage. So whenever it is not comfortably ahead, it also matches
        // the player's own travel with a margin. Per-frame travel, not speed:
        // the player is on the real clock and this is on the scaled one.
        if (dt > 0 && player.y - e.y > -R * 0.5) {
          speed = Math.max(speed, (player.stepDist * BOSS_PURSUE_MARGIN) / dt);
        }
        speed = Math.min(speed, e.speed * BOSS_CATCHUP_MAX);

        // Ease off near the station point so it settles instead of jittering.
        speed *= Math.min(1, d / 40);
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
          // Winding up: creep toward the player and face them. The creep gets
          // the same catch-up as a stationing boss, since otherwise this is
          // the phase in which a charger can be left behind for good.
          const cd = Math.hypot(player.x - e.x, player.y - e.y);
          let cs = e.speed * bossCatchup(cd);
          if (dt > 0 && player.y > e.y) {
            cs = Math.max(cs, (player.stepDist * BOSS_PURSUE_MARGIN) / dt);
          }
          cs = Math.min(cs, e.speed * BOSS_CATCHUP_MAX);
          e.vx = Math.cos(toPlayer) * cs;
          e.vy = Math.sin(toPlayer) * cs;
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

    // A boss that falls behind the darkness would be invisible inside the
    // black, so it rides the edge and climbs back out instead.
    //
    // This is also the HARD guarantee that a boss can never be stranded. The
    // darkness is itself leashed to DARKNESS_MAX_GAP behind the player, so
    // pinning the boss to its edge bounds the boss's distance too - which is
    // what saves the slowest of them (the charger, 55 u/s) when even full
    // catch-up cannot match a flat-out sprint. Measured: against a 700 u/s
    // sprint every boss settles to a fixed gap instead of falling away.
    if (e.isBoss && e.y < darknessY + 24) {
      e.y = darknessY + 24;
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
