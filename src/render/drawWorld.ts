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
import type { Pool } from '../core/pool';
import type { World } from '../game/World';
import type { Enemy } from '../game/entities/Enemy';
import type { Particle } from '../game/entities/Particle';
import { PARTICLE_COLORS } from '../game/entities/Particle';
import type { Drone } from '../game/entities/Drone';
import type { Pickup } from '../game/entities/Pickup';
import type { Projectile } from '../game/entities/Projectile';
import { drawDarkness } from './drawDarkness';
import { getShape } from './shapePaths';
import type { Viewport } from './viewport';

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

function enemyColor(role: string): string {
  switch (role) {
    case 'orange':
      return COLOR.enemyOrange;
    case 'purple':
      return COLOR.enemyPurple;
    case 'green':
      return COLOR.enemyGreen;
    case 'boss':
      return COLOR.boss;
    case 'blue':
      return COLOR.pickup;
    default:
      return COLOR.enemyBlack;
  }
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
    for (let x = 30; x < VIEW_W; x += 90) ctx.fillRect(x, y, 26, 3);
  }
}

/**
 * Debris is drawn UNDER everything else and kept small. The original was
 * criticised for splatter so coarse that players could not tell a shard from
 * an incoming bullet; layering and size both help, and particles never use the
 * reserved enemy-fire hue.
 *
 * Batched by colour so fillStyle changes a handful of times rather than once
 * per particle.
 */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  pool: Pool<Particle>,
): void {
  for (let c = 0; c < PARTICLE_COLORS.length; c++) {
    let any = false;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.active[i];
      if (p.colorIndex !== c) continue;
      if (!any) {
        ctx.fillStyle = PARTICLE_COLORS[c];
        any = true;
      }
      const a = p.life / p.maxLife;
      const s = p.size * (0.5 + a * 0.5);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPickups(
  ctx: CanvasRenderingContext2D,
  pool: Pool<Pickup>,
  realElapsed: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(realElapsed * 3);
  for (let i = 0; i < pool.count; i++) {
    const k = pool.active[i];
    const isWeapon = k.kind === 'weapon';
    const body = isWeapon ? COLOR.pickup : COLOR.enemyGreen;

    // A halo, because the original gave no feedback at all when an upgrade
    // dropped and players asked for exactly this.
    ctx.beginPath();
    ctx.arc(k.x, k.y, 16 + pulse * 7, 0, Math.PI * 2);
    ctx.fillStyle = isWeapon
      ? 'rgba(43, 108, 246, 0.16)'
      : 'rgba(46, 184, 114, 0.16)';
    ctx.fill();

    drawShape(
      ctx,
      isWeapon ? 'block' : 'coin',
      k.x,
      k.y,
      isWeapon ? 26 : 22,
      isWeapon ? Math.sin(k.phase * 2) * 0.25 : 0,
      body,
      COLOR.bg,
    );
  }
}

/**
 * Companions. Drawn above enemies but below bullets: they are the player's,
 * so they must never be mistaken for something incoming, and they use the
 * player's own cool accent rather than the reserved enemy-fire hue.
 */
function drawDrones(ctx: CanvasRenderingContext2D, pool: Pool<Drone>): void {
  for (let i = 0; i < pool.count; i++) {
    const d = pool.active[i];
    drawShape(
      ctx,
      d.shape,
      d.x,
      d.y,
      d.drawSize,
      d.launched ? Math.atan2(d.vy, d.vx) - Math.PI / 2 : d.angle,
      COLOR.playerShot,
      COLOR.bg,
    );
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, pool: Pool<Enemy>): void {
  for (let i = 0; i < pool.count; i++) {
    const e = pool.active[i];
    const frozen = e.frozenFor > 0;
    drawShape(
      ctx,
      e.shape,
      e.x,
      e.y,
      e.drawSize,
      e.angle,
      frozen ? COLOR.freeze : enemyColor(e.colorRole),
      COLOR.bg,
    );
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

    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2.5 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 59, 31, 0.22)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

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

  vp.applyDevice();
  ctx.fillStyle = COLOR.pageBg;
  ctx.fillRect(0, 0, vp.canvas.width, vp.canvas.height);

  // Clip everything that follows to the play rect. The world extends past the
  // 9:16 field in both axes (bullets, enemies and spawn margins all live
  // outside it), so without this they are drawn over the letterbox surround.
  // save/restore carries the clip AND the transform, so setTransform inside
  // the clipped region is safe.
  ctx.save();
  vp.applyUi();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, VIEW_H);
  ctx.clip();

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // ---- world space: +Y up, camera-relative. TEXT IS MIRRORED HERE. --------
  vp.applyWorld(w.camera.y);

  drawBackgroundMarks(ctx, w.camera.y);
  drawParticles(ctx, w.particles);
  drawPickups(ctx, w.pickups, clock.realElapsed);
  drawEnemies(ctx, w.enemies);

  const p = w.player;
  if (p.alive) {
    // The invincibility blink runs on the real clock, matching the timer.
    const blink =
      p.invulnRealFor > 0 &&
      Math.sin(clock.realElapsed * PLAYER_INVULN_BLINK_HZ * Math.PI * 2) < 0;
    if (!blink) {
      drawShape(ctx, p.shape, p.x, p.y, p.drawSize, 0, COLOR.ink, COLOR.bg);
    }
  }

  drawDrones(ctx, w.drones);
  drawPlayerShots(ctx, w.playerShots);
  drawEnemyShots(ctx, w.enemyShots, clock.realElapsed);

  drawDarkness(ctx, w.darkness, w.camera.y, clock.realElapsed);

  ctx.restore();

  // ---- back to UI space for the frame and anything with text --------------
  vp.applyUi();
  ctx.strokeStyle = COLOR.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);
}
