import type { Clock } from '../core/clock';
import {
  COLOR,
  ENEMY_BULLET_MIN_RADIUS,
  WORLD_W,
  ENEMY_RING_PULSE_HZ,
  PLAYER_INVULN_BLINK_HZ,
  PLAYER_OUTLINE_PX,
  SHOT_COLORS,
  SHOT_RIM_PX,
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

/**
 * `outline`, when given, is drawn BEHIND the shape: every layer is stroked at
 * twice `outlinePx` first and the fills then cover the inner half, so exactly
 * `outlinePx` screen pixels show outside the silhouette - and none show at
 * the seams where a shape's own layers overlap.
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  id: ShapeId,
  x: number,
  y: number,
  size: number,
  angle: number,
  body: string,
  accent: string,
  outline: string | null = null,
  outlinePx = 0,
): void {
  const shape = getShape(id);
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  ctx.scale(size, size);
  if (outline !== null) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = (outlinePx * 2) / size;
    ctx.lineJoin = 'round';
    for (let i = 0; i < shape.layers.length; i++) ctx.stroke(shape.layers[i].path);
  }
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
    for (let x = 30; x < WORLD_W; x += 90) ctx.fillRect(x, y, 26, 3);
  }
}

/**
 * The side walls of the playfield.
 *
 * The world is wider than the view, so without these the player has no way to
 * tell how much room is left before the edge - they would only discover a
 * wall by sliding into it. Hatched so they read as solid rather than as
 * another background mark.
 */
function drawWalls(ctx: CanvasRenderingContext2D, cameraY: number): void {
  const top = cameraY + VIEW_H / 2;
  const bottom = cameraY - VIEW_H / 2;
  const w = 10;

  // Drawn just INSIDE the world bounds. Outside them the band sits beyond the
  // camera's own clamp and is never on screen - which is how the first
  // version managed to render walls nobody could see.
  ctx.fillStyle = COLOR.frame;
  ctx.fillRect(0, bottom, w, top - bottom);
  ctx.fillRect(WORLD_W - w, bottom, w, top - bottom);

  ctx.fillStyle = COLOR.hudDim;
  const step = 26;
  const first = Math.floor(bottom / step) * step;
  for (let y = first; y <= top; y += step) {
    ctx.fillRect(0, y, w, 12);
    ctx.fillRect(WORLD_W - w, y, w, 12);
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
 * so they must never be mistaken for something incoming. They wear the colour
 * of what they do, by the same rule as shots, and the same rim.
 */
function drawDrones(ctx: CanvasRenderingContext2D, pool: Pool<Drone>): void {
  for (let i = 0; i < pool.count; i++) {
    const d = pool.active[i];
    const c = SHOT_COLORS[d.def.family];
    drawShape(
      ctx,
      d.shape,
      d.x,
      d.y,
      d.drawSize,
      d.launched ? Math.atan2(d.vy, d.vx) - Math.PI / 2 : d.angle,
      c.body,
      COLOR.bg,
      c.edge,
      SHOT_RIM_PX,
    );
  }
}

/**
 * A snake or trailer, drawn as a chain of segments laid along exactly the
 * capsule the collision code uses (see bodyDist2). Drawing the body any other
 * way would let what you see and what kills you drift apart - for an enemy
 * whose entire threat is its length, that is the one thing it must not do.
 */
function drawLongBody(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  color: string,
): void {
  const dir = e.angle + Math.PI / 2;
  const cx = Math.cos(dir);
  const cy = Math.sin(dir);
  const r = e.hitboxRadius;

  ctx.fillStyle = color;
  if (e.shape === 'car') {
    // Trailer: one long slab.
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillRect(-r, -e.length - r * 0.4, r * 2, e.length + r * 1.4);
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(-r * 0.55, r * 0.15, r * 1.1, r * 0.5);
    ctx.restore();
    return;
  }

  // Snake: overlapping discs, tapering toward the tail.
  const n = Math.max(3, Math.ceil(e.length / (r * 0.9)));
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const rr = r * (1 - t * 0.45);
    ctx.beginPath();
    ctx.arc(e.x - cx * e.length * t, e.y - cy * e.length * t, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes, so the head end is unambiguous.
  ctx.fillStyle = COLOR.bg;
  const px = -cy * r * 0.45;
  const py = cx * r * 0.45;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(e.x + cx * r * 0.3 + px * s, e.y + cy * r * 0.3 + py * s, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, pool: Pool<Enemy>): void {
  // Ground first, air second, so helicopters pass OVER everything else.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (e.flying !== (pass === 1)) continue;

      const frozen = e.frozenFor > 0;
      const color = frozen ? COLOR.freeze : enemyColor(e.colorRole);

      if (e.flying) {
        // A shadow on the ground, offset from the body. Being airborne is the
        // whole rule for these, so it has to read at a glance.
        ctx.fillStyle = 'rgba(30, 32, 36, 0.13)';
        ctx.beginPath();
        ctx.ellipse(e.x + 12, e.y - 16, e.drawSize * 0.42, e.drawSize * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (e.length > 0) {
        drawLongBody(ctx, e, color);
      } else {
        drawShape(ctx, e.shape, e.x, e.y, e.drawSize, e.angle, color, COLOR.bg);
      }
    }
  }
}

/**
 * Player fire: coloured by what it does (SHOT_COLORS), rimmed in a dark shade
 * of its own hue, drawn UNDER enemy fire. The rim is the inverse of enemy
 * fire's white ring, so even a round player shot never wears enemy fire's
 * pattern.
 */
function drawPlayerShots(
  ctx: CanvasRenderingContext2D,
  pool: Pool<Projectile>,
): void {
  for (let i = 0; i < pool.count; i++) {
    const p = pool.active[i];
    const c = SHOT_COLORS[p.family];
    drawShape(
      ctx,
      p.shape,
      p.x,
      p.y,
      p.size,
      p.angle,
      c.body,
      c.edge,
      c.edge,
      SHOT_RIM_PX,
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
  vp.applyWorld(w.camera.x, w.camera.y);

  drawBackgroundMarks(ctx, w.camera.y);
  drawWalls(ctx, w.camera.y);
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
      drawShape(
        ctx,
        p.shape,
        p.x,
        p.y,
        p.drawSize,
        0,
        COLOR.player,
        COLOR.bg,
        COLOR.ink,
        PLAYER_OUTLINE_PX,
      );
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
