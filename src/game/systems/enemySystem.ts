import type { ScaledDt } from '../../core/clock';
import {
  BOSS_CATCHUP_MAX,
  BOSS_CATCHUP_RANGE,
  BOSS_CATCHUP_START,
  BOSS_PURSUE_MARGIN,
  TURN_HOMING,
  VIEW_H,
  VIEW_W,
  WORLD_W,
} from '../../config';
import { DEG, clamp, turnToward } from '../../core/math';
import type { Pool } from '../../core/pool';
import type { Rng } from '../../core/rng';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

const CULL_MARGIN = 220;

/** Bosses hold station at least this far inside the corridor edges. */
const BOSS_EDGE_MARGIN = 70;

/**
 * Squared distance from a point to an enemy's BODY.
 *
 * Most enemies are a circle at (x, y). Snakes and trailers are capsules: a
 * segment running `length` back along their heading, so the whole body is
 * dangerous rather than just the head. Every collision against an enemy goes
 * through here, so a long enemy cannot be harmless along most of its length
 * in one system and lethal in another.
 */
export function bodyDist2(e: Enemy, px: number, py: number): number {
  if (e.length <= 0) {
    const dx = px - e.x;
    const dy = py - e.y;
    return dx * dx + dy * dy;
  }
  // Tail end of the segment, directly behind the head. Follows the FACING
  // (e.angle), not e.heading: zigzag uses heading as its base course, so a
  // weaving snake must not have its heading dragged around by the weave.
  const dir = e.angle + Math.PI / 2;
  const tx = e.x - Math.cos(dir) * e.length;
  const ty = e.y - Math.sin(dir) * e.length;
  const sx = e.x - tx;
  const sy = e.y - ty;
  const segLen2 = sx * sx + sy * sy;
  let t = segLen2 > 0 ? ((px - tx) * sx + (py - ty) * sy) / segLen2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = tx + sx * t;
  const cy = ty + sy * t;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

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
  cameraX: number,
  cameraY: number,
  rng: Rng,
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
      case 'hopper': {
        // Sit still, then leap. The stillness is the tell: a frog that is
        // about to jump looks exactly like one that is not, so the pause is
        // the one moment its next position is unknowable - and the reason to
        // keep a respectful distance.
        e.chargeTimer -= dt;
        if (e.charging) {
          if (e.chargeTimer <= 0) {
            e.charging = false;
            e.chargeTimer = e.def.hopPause ?? 0.8;
            e.vx = 0;
            e.vy = 0;
          }
        } else if (e.chargeTimer <= 0) {
          e.charging = true;
          e.chargeTimer = e.def.hopDuration ?? 0.35;
          const mode = e.def.hopMode ?? 'straight';
          if (mode === 'homing') {
            e.heading = Math.atan2(player.y - e.y, player.x - e.x);
          } else if (mode === 'random') {
            e.heading = rng.next() * Math.PI * 2;
          }
          const s = e.def.hopSpeed ?? e.speed * 4;
          e.vx = Math.cos(e.heading) * s;
          e.vy = Math.sin(e.heading) * s;
        } else {
          e.vx = 0;
          e.vy = 0;
        }
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

        // Clamped to the VISIBLE window rather than the world, so a boss
        // cannot shelter in the off-screen part of the wider field.
        const stationX = clamp(
          player.x + weave,
          cameraX + BOSS_EDGE_MARGIN,
          cameraX + VIEW_W - BOSS_EDGE_MARGIN,
        );

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
        if (player.y - e.y > -R * 0.5) {
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
          if (player.y > e.y) {
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
    // quarter-turn offset. A hopper sitting still keeps its last facing.
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
    // Long bodies get their length added, so a trailer is not deleted while
    // most of it is still on screen.
    const margin = CULL_MARGIN + e.length;
    if (
      !e.isBoss &&
      (e.y > top + e.length ||
        e.y < bottom - e.length ||
        e.x < -margin ||
        e.x > WORLD_W + margin)
    ) {
      e.alive = false;
    }
  }
}
