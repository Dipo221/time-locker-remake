import { COLOR, VIEW_H, VIEW_W } from '../config';
import type { UiRect } from '../core/input';
import type { World } from '../game/World';
import type { Viewport } from './viewport';

/**
 * Deliberately large. The original shipped a pause button players complained
 * was too small to hit, and this is a game you play with a thumb already
 * mid-drag, so the target is ~14% of the screen width.
 */
export const PAUSE_BUTTON: UiRect = {
  id: 'pause',
  x: VIEW_W - 94,
  y: 16,
  w: 78,
  h: 78,
};

/** While paused, the whole screen resumes - no need to find a small button. */
export const RESUME_ZONE: UiRect = {
  id: 'resume',
  x: 0,
  y: 0,
  w: VIEW_W,
  h: VIEW_H,
};

/**
 * Score, coins and the death banner. Drawn in UI space (y down, unflipped), so
 * text renders the right way up.
 *
 * The original only showed score on the result screen and players asked for the
 * per-run coin count, so both are here from the start.
 */
export function drawHud(vp: Viewport, w: World): void {
  const ctx = vp.ctx;
  vp.applyUi();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = COLOR.hud;
  ctx.font = '600 44px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(String(w.score), 22, 20);

  ctx.fillStyle = COLOR.hudDim;
  ctx.font = '500 22px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillText(`COINS ${w.coins}`, 24, 72);

  drawWeaponChips(ctx, w);

  if (w.phase === 'dead') {
    ctx.fillStyle = 'rgba(250, 249, 247, 0.9)';
    ctx.fillRect(0, VIEW_H * 0.34, VIEW_W, 230);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.hud;
    ctx.font = '700 40px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      w.deathCause === 'darkness' ? 'SWALLOWED' : 'DESTROYED',
      VIEW_W / 2,
      VIEW_H * 0.34 + 34,
    );

    ctx.font = '600 72px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(String(w.score), VIEW_W / 2, VIEW_H * 0.34 + 90);

    ctx.fillStyle = COLOR.hudDim;
    ctx.font = '500 24px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('tap to retry', VIEW_W / 2, VIEW_H * 0.34 + 180);
  }
}

/**
 * Boss health, plus an edge marker whenever the boss is off-screen.
 *
 * All of it earns its place. A boss carries hundreds of hit points, so without
 * a bar the player cannot tell a winnable fight from a hopeless one and will
 * simply run. And because a boss never despawns, it must never become
 * untrackable: a play-test outran a T-Rex and spent the rest of the run with
 * an invisible boss somewhere behind them and no further bosses spawning. The
 * marker says which edge it is behind and how far, so "where did it go" is
 * never a question.
 */
export function drawBossBar(vp: Viewport, w: World): void {
  const boss = w.bossAlive();
  if (boss === null || w.phase !== 'playing') return;

  const ctx = vp.ctx;
  vp.applyUi();

  const name = boss.def.displayName ?? 'BOSS';
  const top = w.camera.y + VIEW_H / 2;
  const bottom = w.camera.y - VIEW_H / 2;

  if (boss.y > top || boss.y < bottom) {
    const above = boss.y > top;
    const dist = Math.round(above ? boss.y - top : bottom - boss.y);
    // Pin the marker to the edge it is behind, at its horizontal position.
    const mx = Math.max(60, Math.min(VIEW_W - 60, boss.x));
    const my = above ? 150 : VIEW_H - 150;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = COLOR.enemyShot;
    ctx.beginPath();
    if (above) {
      ctx.moveTo(mx, my - 24);
      ctx.lineTo(mx - 15, my - 2);
      ctx.lineTo(mx + 15, my - 2);
    } else {
      ctx.moveTo(mx, my + 24);
      ctx.lineTo(mx - 15, my + 2);
      ctx.lineTo(mx + 15, my + 2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(name, mx, my + (above ? 20 : -20));
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = '600 17px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(`${dist}`, mx, my + (above ? 42 : -42));
  }

  const x = 26;
  const y = 126;
  const barW = VIEW_W - 52;
  const barH = 13;
  const frac = Math.max(0, Math.min(1, boss.hp / boss.maxHp));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = COLOR.boss;
  ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(name, x, y - 5);

  ctx.fillStyle = 'rgba(36, 26, 46, 0.14)';
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = COLOR.boss;
  ctx.fillRect(x, y, barW * frac, barH);
  ctx.strokeStyle = 'rgba(36, 26, 46, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, barW, barH);
}

export function drawPauseButton(vp: Viewport): void {
  const ctx = vp.ctx;
  vp.applyUi();

  const b = PAUSE_BUTTON;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  ctx.fillStyle = 'rgba(250, 249, 247, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(30, 32, 36, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLOR.hud;
  ctx.fillRect(cx - 10, cy - 12, 7, 24);
  ctx.fillRect(cx + 3, cy - 12, 7, 24);
}

/**
 * A true pause: the main loop stops advancing the clock entirely, so even the
 * darkness and its churning edge stop. That distinction matters in this game -
 * the time freeze stops the simulation but NOT the darkness, so if pause left
 * the darkness creeping it would just be a slower death.
 */
export function drawPauseOverlay(vp: Viewport, w: World): void {
  const ctx = vp.ctx;
  vp.applyUi();

  ctx.fillStyle = 'rgba(250, 249, 247, 0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = COLOR.hud;
  ctx.font = '700 54px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H * 0.42);

  ctx.font = '600 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${w.score}`, VIEW_W / 2, VIEW_H * 0.42 + 56);

  ctx.fillStyle = COLOR.hudDim;
  ctx.font = '500 22px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`COINS ${w.coins}`, VIEW_W / 2, VIEW_H * 0.42 + 92);
  ctx.fillText(
    'tap anywhere to resume',
    VIEW_W / 2,
    VIEW_H * 0.42 + 150,
  );
  ctx.fillText('or press Esc', VIEW_W / 2, VIEW_H * 0.42 + 182);
}

/**
 * The run's loadout, bottom-left. The original showed the weapon list only on
 * the result screen, which meant you could not tell mid-run what you were
 * holding - and with unbounded stacking that is exactly what you want to know.
 */
function drawWeaponChips(ctx: CanvasRenderingContext2D, w: World): void {
  if (w.stacks.size === 0) return;

  let y = VIEW_H - 40;
  ctx.textAlign = 'left';
  ctx.font = '600 17px ui-monospace, Menlo, Consolas, monospace';

  for (const [id, n] of w.stacks) {
    const label = `${id.replace('_', ' ')}  x${n}`;
    const wPx = ctx.measureText(label).width + 20;

    // Opaque, not translucent: these sit at the bottom of the screen, which is
    // exactly where the darkness rises, and blue-on-black is unreadable.
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(20, y - 6, wPx, 26);
    ctx.fillStyle = COLOR.playerShot;
    ctx.fillText(label, 30, y);

    y -= 32;
  }
}
