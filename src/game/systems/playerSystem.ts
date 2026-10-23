import type { RealDt } from '../../core/clock';
import type { InputFrame } from '../../core/input';
import { PLAYER_MAX_SPEED, PLAY_MARGIN, WORLD_W } from '../../config';
import { clamp, len } from '../../core/math';
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
 * The second consumer of RealDt. The original counts this down while time is
 * stopped, and warns players about exactly that.
 */
export function tickInvincibility(p: Player, dt: RealDt): void {
  if (p.invulnRealFor > 0) {
    p.invulnRealFor -= dt;
    if (p.invulnRealFor < 0) p.invulnRealFor = 0;
  }
}
