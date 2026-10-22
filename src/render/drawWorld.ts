import type { Clock } from '../core/clock';
import {
  COLOR,
  ENEMY_BULLET_MIN_RADIUS,
  ENEMY_RING_PULSE_HZ,
  PLAYER_INVULN_BLINK_HZ,
  VIEW_H,
  VIEW_W,
} from '../config';
import type { ShapeId } from '../data/shapes';
import type { World } from '../game/World';
import type { Pool } from '../core/pool';
import type { Projectile } from '../game/entities/Projectile';
import { getShape } from './shapePaths';
import type { Viewport } from './viewport';
import { drawDarkness } from './drawDarkness';

/** Spacing of the background motion marks, in world units. */
const MARK_SPACING = 120;

export function drawShape(
  ctx: CanvasRenderingContext2D,
  id: ShapeId,
  x: number,
  y: number,
  size: number,
  angle: number,
  body: string,
  accent: string,
): void {
  const shape = getShape(id);
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  ctx.scale(size, size);
  for (let i = 0; i < shape.layers.length; i++) {
    const layer = shape.layers[i];
    ctx.fillStyle =
      layer.role === 'accent' ? accent : layer.role === 'ink' ? COLOR.ink : body;
    ctx.fill(layer.path);
  }
  ctx.restore();
}

/**
 * Horizontal tick marks at fixed world positions. Without these a near-empty
 * white field gives no sense of motion at all, and you cannot tell a frozen
 * world from a still one.
 */
function drawBackgroundMarks(
  ctx: CanvasRenderingContext2D,
  cameraY: number,
): void {
  const top = cameraY + VIEW_H / 2;
  const bottom = cameraY - VIEW_H / 2;
  const first = Math.floor(bottom / MARK_SPACING) * MARK_SPACING;

  ctx.fillStyle = COLOR.gridMark;
  for (let y = first; y <= top; y += MARK_SPACING) {
    for (let x = 30; x < VIEW_W; x += 90) {
      ctx.fillRect(x, y, 26, 3);
    }
  }
}

/** Player fire: cool hue, elongated along travel, drawn UNDER enemy fire. */
function drawPlayerShots(
  ctx: CanvasRenderingContext2D,
  pool: Pool<Projectile>,
): void {
  for (let i = 0; i < pool.count; i++) {
    const p = pool.active[i];
    drawShape(
      ctx,
      p.shape,
      p.x,
      p.y,
      p.size,
      p.angle,
      COLOR.playerShot,
      COLOR.playerShotEdge,
    );
  }
}

/**
 * Enemy fire gets FOUR independent differentiators, because "players confused
 * enemy fire with their own" was a specific, named failure of the original and
 * one differentiator is not enough in a dense screen:
 *
 *   1. Hue      - one hot warning colour, reserved; nothing else uses it.
 *   2. Shape    - radially symmetric, so it reads "incoming from anywhere"
 *                 rather than "going somewhere".
 *   3. Ring     - a white separator plus an outer ring, so it stays legible
 *                 against the near-white field AND inside a cloud of own fire.
 *   4. Layer, size floor, and a REAL-clock pulse - drawn last (on top), never
 *                 visually smaller than a player shot, and still breathing
 *                 while the world is frozen. That last detail turns the
 *                 legibility problem into a feature of the core mechanic:
 *                 while you survey a frozen battlefield, the only things still
 *                 moving are the things that can kill you.
 */
function drawEnemyShots(
  ctx: CanvasRenderingContext2D,
  pool: Pool<Projectile>,
  realElapsed: number,
): void {
  const pulse =
    0.5 + 0.5 * Math.sin(realElapsed * ENEMY_RING_PULSE_HZ * Math.PI * 2);

  for (let i = 0; i < pool.count; i++) {
    const p = pool.active[i];
    const r = Math.max(p.size * 0.5, ENEMY_BULLET_MIN_RADIUS);

    // Outer pulsing ring.
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2.5 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 59, 31, 0.22)';
    ctx.fill();

    // White separator, so it never melts into the background or own fire.
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Core.
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.enemyShot;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.enemyShotEdge;
    ctx.fill();
  }
}

export function drawWorld(vp: Viewport, w: World, clock: Clock): void {
  const ctx = vp.ctx;

  // Letterbox surround, in raw device pixels.
  vp.applyDevice();
  ctx.fillStyle = COLOR.pageBg;
  ctx.fillRect(0, 0, vp.canvas.width, vp.canvas.height);

  // Play field.
  vp.applyUi();
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ---- world space: +Y up, camera-relative. TEXT IS MIRRORED HERE. --------
  vp.applyWorld(w.camera.y);

  drawBackgroundMarks(ctx, w.camera.y);

  const p = w.player;
  if (p.alive) {
    // Invincibility blink runs on the real clock, matching the timer itself.
    const blink =
      p.invulnRealFor > 0 &&
      Math.sin(clock.realElapsed * PLAYER_INVULN_BLINK_HZ * Math.PI * 2) < 0;
    if (!blink) {
      drawShape(
        ctx,
        p.shape,
        p.x,
        p.y,
        p.drawSize,
        0,
        COLOR.ink,
        COLOR.playerShot,
      );
    }
  }

  drawPlayerShots(ctx, w.playerShots);
  drawEnemyShots(ctx, w.enemyShots, clock.realElapsed);

  drawDarkness(ctx, w.darkness, w.camera.y, clock.realElapsed);

  // ---- back to UI space for the frame and anything with text --------------
  vp.applyUi();
  ctx.strokeStyle = COLOR.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);
}
