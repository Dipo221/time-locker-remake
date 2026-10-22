import type { RealDt } from '../core/clock';
import {
  CAMERA_DARKNESS_SLACK,
  CAMERA_DEADZONE,
  CAMERA_FOLLOW_TAU,
  CAMERA_LOOKAHEAD,
  VIEW_H,
} from '../config';
import { expSmooth } from '../core/math';

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

  reset(playerY: number): void {
    this.y = playerY + CAMERA_LOOKAHEAD;
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
