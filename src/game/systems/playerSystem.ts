import type { RealDt, ScaledDt } from '../../core/clock';
import type { InputFrame } from '../../core/input';
import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE,
  BASE_BULLET_SPEED,
  BASE_FIRE_CADENCE,
  PLAYER_DRAG_GAIN,
  PLAYER_MAX_SPEED,
  PLAY_MARGIN,
  VIEW_W,
} from '../../config';
import { clamp, len } from '../../core/math';
import type { Player } from '../entities/Player';
import type { World } from '../World';

/**
 * The player's BODY is on the REAL clock.
 *
 * This is deliberate and load-bearing. Scaling the player's own movement by
 * timeScale would be a feedback loop - moving slowly would make you move even
 * more slowly, and you would get stuck. Because position is real-time, the
 * player can still dodge at timeScale 0, and the instant they move, time
 * resumes. That asymmetry IS the game: the freeze is a power, not a pause.
 */
export function updatePlayerBody(
  p: Player,
  input: InputFrame,
  dt: RealDt,
): void {
  if (!p.alive) {
    p.speed = 0;
    return;
  }

  let dx = 0;
  let dy = 0;
  if (input.holding) {
    dx = input.dx * PLAYER_DRAG_GAIN;
    dy = input.dy * PLAYER_DRAG_GAIN;

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
  p.speed = dt > 0 ? len(dx, dy) / dt : 0;

  // Horizontal corridor. Y is unbounded: forward progress is the game.
  p.x = clamp(p.x, PLAY_MARGIN, VIEW_W - PLAY_MARGIN);
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

/**
 * The player's GUNS are on the SCALED clock, so a frozen player fires nothing.
 * No special-casing: it falls out of the clock split for free.
 *
 * MILESTONE 1: a single hardcoded forward emitter. Step 8 replaces the body of
 * this function with `compileLoadout()` output; the clock discipline and the
 * call site do not change.
 */
export function updatePlayerGuns(w: World, dt: ScaledDt): void {
  const p = w.player;
  if (!p.alive) return;
  // Frozen time fires nothing. Without this the very first frame (cooldown 0,
  // dt 0) would leak one shot, and so would any frame where the cooldown had
  // already reached zero before the player stopped.
  if (dt === 0) return;

  p.fireCooldown -= dt;
  if (p.fireCooldown > 0) return;
  p.fireCooldown += BASE_FIRE_CADENCE;

  const shot = w.playerShots.spawn();
  if (shot === null) return;

  shot.x = p.x;
  shot.y = p.y + p.drawSize * 0.4;
  shot.vx = 0;
  shot.vy = BASE_BULLET_SPEED;
  shot.angle = 0;
  shot.radius = BASE_BULLET_SIZE * 0.4;
  shot.size = BASE_BULLET_SIZE;
  shot.damage = BASE_BULLET_DAMAGE;
  shot.life = BASE_BULLET_LIFETIME;
  shot.faction = 0;
  shot.shape = 'bulletLong';
  shot.maxHits = 1;
  shot.hits = 0;
}
