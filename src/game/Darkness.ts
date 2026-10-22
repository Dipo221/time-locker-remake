import type { RealDt } from '../core/clock';
import {
  DARKNESS_BASE_SPEED,
  DARKNESS_CATCHUP_GAP,
  DARKNESS_CATCHUP_K,
  DARKNESS_CONTINUE_PUSHBACK,
  DARKNESS_KILL_INSET,
  DARKNESS_MAX_GAP,
  DARKNESS_RAMP_MAX,
  DARKNESS_RAMP_SCORE,
  DARKNESS_START_GAP,
} from '../config';

/**
 * The looming darkness - the ONE system that ignores timeScale.
 *
 * It advances on the REAL clock, which is the entire reason standing still
 * kills you, and the reason the time-freeze is a tactical resource rather than
 * a pause button. Note the `dt: RealDt` signature: passing `clock.scaled` here
 * is a compile error, which is exactly the protection this system needs.
 *
 * With the world being +Y up, "gap" is simply `player.y - this.y`: a positive
 * number that shrinks when you dawdle. No separate progress bookkeeping exists
 * anywhere in the game - the gap IS the score of the chase.
 */
export class Darkness {
  /** World Y of the upper edge. Everything at or below this is death. */
  y = 0;
  /** Cached for the debug overlay and the result screen. */
  speed = DARKNESS_BASE_SPEED;

  reset(playerY: number): void {
    this.y = playerY - DARKNESS_START_GAP;
    this.speed = DARKNESS_BASE_SPEED;
  }

  /**
   * @param dt REAL seconds. Uses the SAME clamped delta as the rest of the
   *           frame, so a long stall (tab switch, GC spike) cannot teleport the
   *           darkness forward and instantly swallow the player.
   */
  update(playerY: number, score: number, dt: RealDt): void {
    const ramp = Math.min(DARKNESS_RAMP_MAX, 1 + score / DARKNESS_RAMP_SCORE);
    this.speed = DARKNESS_BASE_SPEED * ramp;

    this.y += this.speed * dt;

    // Rubber band: beyond a comfortable lead it accelerates, so pure fleeing
    // has a capped reward and the chase never becomes irrelevant.
    const gap = playerY - this.y;
    if (gap > DARKNESS_CATCHUP_GAP) {
      this.y += (gap - DARKNESS_CATCHUP_GAP) * DARKNESS_CATCHUP_K * dt;
    }

    // Hard leash.
    this.y = Math.max(this.y, playerY - DARKNESS_MAX_GAP);
  }

  gapTo(playerY: number): number {
    return playerY - this.y;
  }

  /** Seconds of standing still before it reaches `playerY`. */
  timeToReach(playerY: number): number {
    return Math.max(0, this.gapTo(playerY)) / this.speed;
  }

  swallows(playerY: number): boolean {
    return playerY <= this.y - DARKNESS_KILL_INSET;
  }

  /** On continue: shove it back to give the player room to breathe. */
  pushBack(): void {
    this.y -= DARKNESS_CONTINUE_PUSHBACK;
  }
}
