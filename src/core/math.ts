export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate-independent exponential smoothing coefficient.
 * `v += (target - v) * expSmooth(dt, tau)`
 */
export function expSmooth(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Shortest signed angular difference, in radians, wrapped to [-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  return from + clamp(d, -maxStep, maxStep);
}
