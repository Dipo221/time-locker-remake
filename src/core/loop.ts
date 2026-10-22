import { MAX_FRAME_DT } from '../config';

/**
 * requestAnimationFrame driver.
 *
 * The only subtlety is the clamp. A long frame (tab switch, GC spike,
 * breakpoint) must not teleport anything - and critically, the darkness is fed
 * the SAME clamped delta, so a five-second stall cannot instantly swallow the
 * player. The world slows down rather than jumping.
 *
 * There is no fixed-timestep accumulator here, deliberately. The simulation is
 * purely kinematic (p += v*dt with turn-rate steering - no springs, no stacked
 * bodies, no constraint solver), so variable dt is exact for constant velocity.
 * More importantly, a fixed accumulator fed from SCALED time is actively
 * incompatible with this game: at timeScale ~0.02 it would take zero steps for
 * dozens of consecutive frames and then one large step, stuttering precisely in
 * the micro-movement range the entire game is built around. Determinism for
 * tests is bought separately, by feeding a scripted dt sequence here.
 */
export function startLoop(step: (realDt: number) => void): () => void {
  let last = performance.now();
  let raf = 0;

  const frame = (now: number): void => {
    let dt = (now - last) / 1000;
    last = now;
    // Guard the first frame and any non-finite clock reading.
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;

    step(dt);
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
