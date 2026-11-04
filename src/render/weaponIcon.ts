import { BASE_BULLET_SIZE } from '../config';
import { getDrone } from '../data/drones';
import { getProjectileWeapon } from '../data/weapons';
import type { WeaponId } from '../game/weapons/types';
import { drawShape } from './drawWorld';

/**
 * A weapon's icon, drawn from its own data rather than from a sprite sheet:
 * the bullets it fires, pointing where they go. TWIN reads as two parallel
 * bars, WIDE as a V, SIDE as a pair aimed left and right, LINE as three -
 * and a new weapon gets an honest icon without anyone drawing one.
 *
 * Effects add one mark each: a trail for homing, spikes for a blast, a
 * six-point star for ice. Drones are drawn as themselves.
 *
 * UI space (y down), centred on (cx, cy), roughly `size` across.
 */
export function drawWeaponIcon(
  ctx: CanvasRenderingContext2D,
  id: WeaponId,
  cx: number,
  cy: number,
  size: number,
  color: string,
  bg: string,
): void {
  const drone = getDrone(id);
  if (drone !== undefined) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, -1); // shapes are authored +Y forward
    drawShape(ctx, drone.shape, 0, 0, size * 0.85, 0, color, bg);
    ctx.restore();
    return;
  }

  const def = getProjectileWeapon(id);
  if (def === undefined) return;
  const e = def.emitters[0];
  const p = e.projectile;
  const kinds = (p.behaviours ?? []).map((b) => b.kind);
  const homes = kinds.includes('homing');
  const blasts = kinds.includes('explodeOnHit');
  const freezes = kinds.includes('freezing');

  // Side-firing patterns radiate from the middle; forward ones from below,
  // so the whole icon reads as "fires this way".
  const sideways = e.anglesDeg.some((a) => Math.abs(a) > 60);
  const ox = cx;
  const oy = sideways ? cy : cy + size * 0.36;
  const reach = sideways ? size * 0.3 : size * 0.5;
  const burst = Math.min(3, e.burst);

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  for (const deg of e.anglesDeg) {
    const a = (deg * Math.PI) / 180;
    // 0 = up, positive = clockwise, in a y-down space.
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    for (let b = 0; b < burst; b++) {
      // A burst is drawn as parallel lanes: at icon scale its few degrees of
      // spread would put the bullets on top of each other.
      const lane = (b - (burst - 1) / 2) * size * 0.27;
      const x = ox + dx * reach - dy * lane;
      const y = oy + dy * reach + dx * lane;

      if (p.shape === 'beam') {
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.moveTo(ox - dy * lane, oy + dx * lane);
        ctx.lineTo(ox + dx * size * 0.78 - dy * lane, oy + dy * size * 0.78 + dx * lane);
        ctx.stroke();
      } else if (p.shape === 'bulletRound') {
        const r = size * 0.14 * Math.min(1.6, Math.max(0.9, p.size / BASE_BULLET_SIZE));
        if (freezes) {
          star(ctx, x, y, r * 1.7, size * 0.1);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (blasts) spikes(ctx, x, y, r * 1.5, r * 2.3, size * 0.08);
        if (homes) trail(ctx, x, y, dx, dy, r, size * 0.08);
      } else {
        // A bar along the line of fire.
        ctx.lineWidth = size * 0.15;
        ctx.beginPath();
        ctx.moveTo(x - dx * size * 0.2, y - dy * size * 0.2);
        ctx.lineTo(x + dx * size * 0.2, y + dy * size * 0.2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, w: number): void {
  ctx.lineWidth = w;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
}

function spikes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r0: number,
  r1: number,
  w: number,
): void {
  ctx.lineWidth = w;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
  }
  ctx.stroke();
}

/** A hooked trail behind a homing shot: it curved to get here. */
function trail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
  w: number,
): void {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x - dx * r * 1.4, y - dy * r * 1.4);
  ctx.quadraticCurveTo(
    x - dx * r * 3.2 + dy * r * 2.2,
    y - dy * r * 3.2 - dx * r * 2.2,
    x - dx * r * 4.4,
    y - dy * r * 4.4,
  );
  ctx.stroke();
}
