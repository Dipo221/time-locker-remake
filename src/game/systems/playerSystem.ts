import type { RealDt } from '../../core/clock';
import type { InputFrame } from '../../core/input';
import {
  PLAYER_MAX_SPEED,
  PLAYER_SOLID_RADIUS_FRAC,
  PLAY_MARGIN,
  WORLD_W,
} from '../../config';
import { clamp, len } from '../../core/math';
import type { Pool } from '../../core/pool';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

/**
 * The player's BODY is on the REAL clock.
 *
 * This is deliberate and load-bearing. Scaling the player's own movement by
 * timeScale would be a feedback loop - moving slowly would make you move even
 * more slowly, and you would get stuck. Because position is real-time, the
 * player can still dodge at timeScale 0, and the instant they move, time
 * resumes. That asymmetry IS the game: the freeze is a power, not a pause.
 *
 * The guns, by contrast, are on the scaled clock - see weaponSystem.
 */
export function updatePlayerBody(
  p: Player,
  input: InputFrame,
  dt: RealDt,
): void {
  if (!p.alive) {
    p.speed = 0;
    p.stepDist = 0;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (input.holding) {
    dx = input.dx * p.dragGain;
    dy = input.dy * p.dragGain;

    // Clamp so a flicked pointer (or a long frame) cannot teleport us through
    // an enemy. This is a movement clamp, not a time clamp.
    if (dt > 0) {
      const maxStep = PLAYER_MAX_SPEED * dt;
      const d = len(dx, dy);
      if (d > maxStep) {
        const k = maxStep / d;
        dx *= k;
        dy *= k;
      }
    }
  }

  p.x += dx;
  p.y += dy;
  p.stepDist = len(dx, dy);
  p.speed = dt > 0 ? p.stepDist / dt : 0;

  // The corridor is the WORLD, which is wider than the view; the camera pans
  // to follow. Y is unbounded: forward progress is the game.
  p.x = clamp(p.x, PLAY_MARGIN, WORLD_W - PLAY_MARGIN);
}

/**
 * Obstacles stop you: after moving, the player is pushed back out of every
 * solid it overlaps, to the nearest point on that obstacle's surface. Pushing
 * to the NEAREST point is what makes you slide along a block's face when you
 * drag into it at an angle, rather than sticking to it.
 *
 * Run right after the body moves and before the camera follows, so the view
 * never shows the player inside a block. Two passes settle the case of being
 * wedged between two obstacles, or an obstacle and a wall.
 */
export function pushOutOfSolids(p: Player, pool: Pool<Enemy>): void {
  if (!p.alive) return;
  const pr = p.drawSize * PLAYER_SOLID_RADIUS_FRAC;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (!e.alive || !e.solid) continue;

      if (e.boxHalf > 0) {
        pushCircleOutOfBox(p, e.x, e.y, e.boxHalf, pr);
        continue;
      }

      const r = pr + e.hitboxRadius;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;

      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = e.x + (dx / d) * r;
        p.y = e.y + (dy / d) * r;
      } else {
        // Dead centre of a round one: back out toward the darkness, the one
        // direction that is always open.
        p.y = e.y - r;
      }
    }
    p.x = clamp(p.x, PLAY_MARGIN, WORLD_W - PLAY_MARGIN);
  }
}

/**
 * Pushes a circle of radius `r` at `p` out of the square of half-size `h`
 * centred on (cx, cy), to the nearest point outside it. Returns whether they
 * overlapped. Shared by obstacles in a run and the machines in the lobby.
 */
export function pushCircleOutOfBox(
  p: { x: number; y: number },
  cx: number,
  cy: number,
  h: number,
  r: number,
): boolean {
  const qx = clamp(p.x, cx - h, cx + h);
  const qy = clamp(p.y, cy - h, cy + h);
  const dx = p.x - qx;
  const dy = p.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;

  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    p.x = qx + (dx / d) * r;
    p.y = qy + (dy / d) * r;
  } else {
    // Centre inside the square: leave by whichever face is closest.
    const l = p.x - (cx - h);
    const rt = cx + h - p.x;
    const dn = p.y - (cy - h);
    const up = cy + h - p.y;
    const m = Math.min(l, rt, dn, up);
    if (m === dn) p.y = cy - h - r;
    else if (m === l) p.x = cx - h - r;
    else if (m === rt) p.x = cx + h + r;
    else p.y = cy + h + r;
  }
  return true;
}

/**
 * The second consumer of RealDt. The original counts this down while time is
 * stopped, and warns players about exactly that.
 */
export function tickInvincibility(p: Player, dt: RealDt): void {
  if (p.invulnRealFor > 0) {
    p.invulnRealFor -= dt;
    if (p.invulnRealFor < 0) p.invulnRealFor = 0;
  }
}
