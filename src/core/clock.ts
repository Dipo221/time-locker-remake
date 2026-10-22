/**
 * THE most important file in the project.
 *
 * There are exactly two clocks:
 *   - REAL   — wall time. The darkness and the post-continue invincibility.
 *   - SCALED — real * timeScale. Everything else in the simulation.
 *
 * If that split leaks, the game is broken in a way that is very hard to see: a
 * bullet creeping one pixel while "frozen" destroys the whole illusion. So the
 * two are *branded* distinct types, and this module is the ONLY place allowed
 * to mint them. Systems then declare which they are entitled to:
 *
 *     export function updateEnemies(w: World, dt: ScaledDt): void
 *     export function updateDarkness(d: Darkness, dt: RealDt): void
 *
 * ...which makes `updateEnemies(world, clock.real)` a compile error, at zero
 * runtime cost.
 */

declare const RealBrand: unique symbol;
declare const ScaledBrand: unique symbol;

/** Seconds of wall time this frame (clamped). Only the darkness & invuln. */
export type RealDt = number & { readonly [RealBrand]: true };
/** real * timeScale. Zero when the player holds still. The simulation. */
export type ScaledDt = number & { readonly [ScaledBrand]: true };

export interface Clock {
  readonly real: RealDt;
  readonly scaled: ScaledDt;
  readonly timeScale: number;
  /** Monotonic real seconds. For visual pulses that must never stop. */
  readonly realElapsed: number;
  /** Monotonic scaled seconds. For animation phases that should freeze. */
  readonly scaledElapsed: number;
  readonly frame: number;
}

/** Mutable backing store. The only minting site for RealDt / ScaledDt. */
export class ClockSource implements Clock {
  real = 0 as RealDt;
  scaled = 0 as ScaledDt;
  timeScale = 0;
  realElapsed = 0;
  scaledElapsed = 0;
  frame = 0;

  advance(realDt: number, timeScale: number): void {
    this.real = realDt as RealDt;
    this.timeScale = timeScale;
    this.scaled = (realDt * timeScale) as ScaledDt;
    this.realElapsed += realDt;
    this.scaledElapsed += realDt * timeScale;
    this.frame++;
  }

  /** For the death hold, which runs on real time at a forced scale. */
  asScaled(seconds: number): ScaledDt {
    return seconds as ScaledDt;
  }

  reset(): void {
    this.real = 0 as RealDt;
    this.scaled = 0 as ScaledDt;
    this.timeScale = 0;
    this.realElapsed = 0;
    this.scaledElapsed = 0;
    this.frame = 0;
  }
}
