import { COLOR, DARKNESS_FEATHER, VIEW_H, VIEW_W } from '../config';
import type { Darkness } from '../game/Darkness';

/** How finely the churning edge is tessellated, in world units. */
const EDGE_STEP = 10;
const OVERSHOOT = 24;

/**
 * The single most important visual in the game.
 *
 * The edge is animated on `realElapsed`, NOT on scaled time. When the player
 * stops and every bullet and animal on screen locks solid while this black mass
 * keeps churning upward, the core mechanic teaches itself without a word of
 * tutorial. Do not "fix" this to use scaled time.
 */
export function drawDarkness(
  ctx: CanvasRenderingContext2D,
  d: Darkness,
  cameraY: number,
  realElapsed: number,
): void {
  const viewBottom = cameraY - VIEW_H / 2;
  // Nothing to draw if the mass is entirely below the view.
  if (d.y < viewBottom - OVERSHOOT) return;

  const t = realElapsed;
  // Three harmonics: a slow swell, a mid ripple, a fast chop. Summed they never
  // visibly repeat, which is what makes it read as "alive" rather than "a wave".
  const edgeAt = (x: number): number =>
    d.y +
    Math.sin(x * 0.012 + t * 1.1) * 9 +
    Math.sin(x * 0.031 - t * 1.9) * 5 +
    Math.sin(x * 0.067 + t * 3.3) * 2.5;

  const left = -OVERSHOOT;
  const right = VIEW_W + OVERSHOOT;
  const floor = viewBottom - OVERSHOOT * 4;

  // --- soft feather above the solid edge ------------------------------------
  // Declared in world coordinates, so the flipped transform handles it.
  const grad = ctx.createLinearGradient(0, d.y + DARKNESS_FEATHER, 0, d.y);
  grad.addColorStop(0, 'rgba(6, 7, 10, 0)');
  grad.addColorStop(0.55, 'rgba(6, 7, 10, 0.28)');
  grad.addColorStop(1, 'rgba(6, 7, 10, 0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(left, d.y, right - left, DARKNESS_FEATHER);

  // --- tendrils, rising and receding on the real clock ----------------------
  ctx.fillStyle = 'rgba(6, 7, 10, 0.55)';
  for (let i = 0; i < 7; i++) {
    const phase = t * 0.7 + i * 2.39996;
    const x = ((i * 97.3 + Math.sin(phase * 0.31) * 40) % VIEW_W + VIEW_W) % VIEW_W;
    const h = 18 + (Math.sin(phase) * 0.5 + 0.5) * 62;
    const halfW = 7 + (Math.cos(phase * 0.8) * 0.5 + 0.5) * 9;
    const baseY = edgeAt(x);
    ctx.beginPath();
    ctx.moveTo(x - halfW, baseY);
    ctx.lineTo(x, baseY + h);
    ctx.lineTo(x + halfW, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // --- the solid mass -------------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(left, floor);
  ctx.lineTo(left, edgeAt(left));
  for (let x = left; x <= right; x += EDGE_STEP) ctx.lineTo(x, edgeAt(x));
  ctx.lineTo(right, edgeAt(right));
  ctx.lineTo(right, floor);
  ctx.closePath();
  ctx.fillStyle = COLOR.darkness;
  ctx.fill();
}
