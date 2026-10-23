import type { RealDt } from '../core/clock';
import {
  CAMERA_DARKNESS_SLACK,
  CAMERA_DEADZONE,
  CAMERA_FOLLOW_TAU,
  CAMERA_LOOKAHEAD,
  CAMERA_X_PLAYER_MARGIN,
  CAMERA_X_TAU,
  PLAY_MARGIN,
  VIEW_H,
  VIEW_W,
  WORLD_W,
} from '../config';
import { clamp, expSmooth } from '../core/math';

/**
 * Dead-zone follow with lookahead. Real clock, because it follows the player's
 * body, which is also on the real clock.
 *
 * `y` is the world Y shown at the vertical centre of the play rect. Sitting
 * CAMERA_LOOKAHEAD ahead of the player puts the player in the lower third and
 * leaves room to see what is coming.
 *
 * The camera doubles as the tension meter and needs no HUD element: when the
 * gap is large the darkness is simply off the bottom of the screen and you feel
 * safe; as the gap closes it slides into frame and eats the bottom third.
 */
export class Camera {
  y = 0;
  /** World X shown at the LEFT edge of the view. */
  x = 0;

  reset(playerX: number, playerY: number): void {
    this.y = playerY + CAMERA_LOOKAHEAD;
    this.x = this.targetX(playerX);
  }

  /**
   * Map the player's position across the world onto the camera's own range.
   *
   * A dead-zone follow would be the usual choice, but it cannot reach the
   * extremes: it stops a dead-zone short of its target, which would leave the
   * side walls permanently just off screen - exactly the thing the wider
   * world exists to show. Linear mapping guarantees that standing against a
   * wall puts that wall at the edge of the view.
   */
  private targetX(playerX: number): number {
    const span = WORLD_W - VIEW_W;
    if (span <= 0) return 0;
    const t = clamp(
      (playerX - PLAY_MARGIN) / (WORLD_W - PLAY_MARGIN * 2),
      0,
      1,
    );
    return t * span;
  }

  followX(playerX: number, dt: RealDt): void {
    const target = this.targetX(playerX);
    this.x += (target - this.x) * expSmooth(dt, CAMERA_X_TAU);

    // Hard guarantee that the player is on screen. The smoothing lags, and the
    // player's body is on the real clock and can cross the field far faster
    // than the camera eases - without this they slide off the edge during a
    // fast sweep. Visibility first, then the world bound: at a wall the
    // margin cannot be honoured, and the world bound is the one that must win.
    const edge = CAMERA_X_PLAYER_MARGIN;
    this.x = clamp(this.x, playerX - VIEW_W + edge, playerX - edge);
    this.x = clamp(this.x, 0, Math.max(0, WORLD_W - VIEW_W));
  }

  follow(playerY: number, darknessY: number, dt: RealDt): void {
    const target = playerY + CAMERA_LOOKAHEAD;
    const d = target - this.y;

    // Dead zone: small player movements do not drag the whole world around.
    if (Math.abs(d) > CAMERA_DEADZONE) {
      const desired = target - Math.sign(d) * CAMERA_DEADZONE;
      this.y += (desired - this.y) * expSmooth(dt, CAMERA_FOLLOW_TAU);
    }

    // Guard: if the camera lags (player stops dead and the darkness rushes up),
    // never let the black claim more than CAMERA_DARKNESS_SLACK of the view.
    const floor = darknessY + VIEW_H * (0.5 - CAMERA_DARKNESS_SLACK);
    if (this.y < floor) this.y = floor;
  }
}
