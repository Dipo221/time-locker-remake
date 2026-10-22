import {
  POINTER_STALE_SEC,
  TS_GAMMA,
  TS_MAX,
  TS_MIN,
  TS_RELEASE_TAU,
  TS_SNAP_ZERO,
  TS_SPEED_DEADZONE,
  TS_SPEED_FULL,
  TS_TAU_DOWN,
  TS_TAU_UP,
} from '../config';
import { clamp01, expSmooth } from './math';

/**
 * Maps pointer movement speed to world time scale. This IS the game.
 *
 *   vInst     = pathLength / realDt          (0 when stale or not holding)
 *   vSmooth  += (vInst - vSmooth) * expSmooth(realDt, tau)
 *   n         = clamp01((vSmooth - DEADZONE) / (FULL - DEADZONE))
 *   timeScale = TS_MIN + (TS_MAX - TS_MIN) * n^TS_GAMMA
 *
 * Three decisions worth knowing:
 *
 * 1. We smooth the SPEED and then apply the curve, not the other way round.
 *    "Recent average hand speed" is physically meaningful; smoothing after the
 *    gamma would make tau and the exponent interact in a way nobody can reason
 *    about. The mapping is monotonic, so asymmetric attack/release survives it.
 *
 * 2. `tau` is asymmetric on purpose: a short attack so starting to move responds
 *    instantly, a longer release so the freeze eases in rather than snapping.
 *
 * 3. Staleness (POINTER_STALE_SEC) is essential, not a nicety. A pointer held
 *    perfectly still emits NO events, so without it `vInst` keeps its last
 *    value forever and the world never freezes.
 */
export class TimeScaleController {
  /** Current world time scale. */
  value = 0;
  /** Exposed for the debug overlay: these two tell you whether a bad feel is
   *  noisy input or a wrong curve. */
  vInst = 0;
  vSmooth = 0;

  /**
   * @param pathLength    pointer path travelled this frame, in world units
   *                      (path length, not net displacement)
   * @param holding       is the pointer currently down
   * @param sinceLastMove real seconds since the last pointermove event
   * @param realDt        unscaled, clamped frame delta
   */
  update(
    pathLength: number,
    holding: boolean,
    sinceLastMove: number,
    realDt: number,
  ): number {
    const stale = sinceLastMove > POINTER_STALE_SEC;
    this.vInst = !holding || stale || realDt <= 0 ? 0 : pathLength / realDt;

    const tau = !holding
      ? TS_RELEASE_TAU
      : this.vInst > this.vSmooth
        ? TS_TAU_UP
        : TS_TAU_DOWN;

    this.vSmooth += (this.vInst - this.vSmooth) * expSmooth(realDt, tau);

    const n = clamp01(
      (this.vSmooth - TS_SPEED_DEADZONE) / (TS_SPEED_FULL - TS_SPEED_DEADZONE),
    );
    let ts = TS_MIN + (TS_MAX - TS_MIN) * Math.pow(n, TS_GAMMA);

    // Snap to a hard zero so the freeze is absolute. Without this the world
    // creeps imperceptibly forever, which reads subconsciously as "broken"
    // long before anyone can name it.
    if (ts < TS_SNAP_ZERO) ts = 0;

    this.value = ts;
    return ts;
  }

  /** Immediate full stop, with no momentum tail. For untrustworthy input. */
  kill(): void {
    this.vInst = 0;
    this.vSmooth = 0;
    this.value = 0;
  }

  reset(): void {
    this.kill();
  }
}
