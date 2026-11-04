import { COLOR, SHOT_COLORS, VIEW_H, VIEW_W } from '../config';
import type { UiRect } from '../core/input';
import type { World } from '../game/World';
import { weaponFamily } from '../game/weapons/compile';
import type { ShotFamily } from '../game/weapons/types';
import { drawButton, roundRect } from './ui';
import type { Viewport } from './viewport';
import { TILES_W, drawWeaponTiles, tilesHeight } from './weaponTiles';

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

/**
 * While paused, the whole screen resumes - no need to find a small button.
 * Listed AFTER the gear, so the gear's own tap is not taken for a resume.
 */
export const RESUME_ZONE: UiRect = {
  id: 'resume',
  x: 0,
  y: 0,
  w: VIEW_W,
  h: VIEW_H,
};

/** Bottom-left on the pause screen, as in the original. */
export const GEAR_BUTTON: UiRect = { id: 'gear', x: 24, y: 836, w: 170, h: 88 };

/** The settings menu the gear opens. A tap outside it closes it. */
const MENU = { x: 60, y: 330, w: VIEW_W - 120, h: 300 };
export const MENU_END_RUN: UiRect = { id: 'endRun', x: 90, y: 410, w: VIEW_W - 180, h: 80 };
export const MENU_BACK: UiRect = { id: 'menuBack', x: 90, y: 510, w: VIEW_W - 180, h: 64 };
export const MENU_OUTSIDE: UiRect = { id: 'menuBack', x: 0, y: 0, w: VIEW_W, h: VIEW_H };

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
    // The HUD is in view space but the boss is in world space, so the camera
    // pan has to be subtracted.
    const mx = Math.max(60, Math.min(VIEW_W - 60, boss.x - w.camera.x));
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
  // The name in ink: orange-red text on the near-white field reads poorly.
  ctx.fillStyle = COLOR.hud;
  ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(name, x, y - 5);

  ctx.fillStyle = 'rgba(30, 32, 36, 0.10)';
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = COLOR.boss;
  ctx.fillRect(x, y, barW * frac, barH);
  ctx.strokeStyle = 'rgba(30, 32, 36, 0.3)';
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
 *
 * Laid out after the original's: the battlefield left in full view, the
 * score turned red top-left, PAUSE under a magenta resume button where the
 * pause button was, the loadout as tiles bottom-right and the settings gear
 * bottom-left. Replaces the in-run HUD while it is up.
 */
export function drawPauseScreen(
  vp: Viewport,
  w: World,
  best: number,
  menuOpen: boolean,
): void {
  const ctx = vp.ctx;
  vp.applyUi();
  const heavy = 'italic 900';
  const sans = 'ui-sans-serif, system-ui, sans-serif';

  ctx.textBaseline = 'middle';

  // ---- top-left: TOP and the score, in red -------------------------------
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR.pauseScore;
  ctx.font = `${heavy} 26px ${sans}`;
  // The record as it stood when the run began, as the original shows it:
  // the gap to it is the point.
  ctx.fillText(`TOP ${best}`, 22, 36);
  // As large as fits beside the coin count.
  let size = 64;
  ctx.font = `${heavy} ${size}px ${sans}`;
  const sw = ctx.measureText(String(w.score)).width;
  if (sw > 240) size = Math.floor((size * 240) / sw);
  ctx.font = `${heavy} ${size}px ${sans}`;
  ctx.fillText(String(w.score), 20, 88);

  // ---- top-right: coins, the C badge, the resume button, PAUSE -----------
  const b = PAUSE_BUTTON;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.fillStyle = COLOR.player;
  ctx.beginPath();
  ctx.arc(cx, cy, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 15);
  ctx.lineTo(cx + 15, cy);
  ctx.lineTo(cx - 9, cy + 15);
  ctx.closePath();
  ctx.fill();

  const badgeX = b.x - 8 - 44;
  ctx.fillStyle = COLOR.enemyGreen;
  roundRect(ctx, badgeX, cy - 22, 44, 44, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `900 28px ${sans}`;
  ctx.fillText('C', badgeX + 22, cy + 1);
  ctx.fillStyle = COLOR.hud;
  ctx.textAlign = 'right';
  ctx.font = `${heavy} 46px ${sans}`;
  ctx.fillText(String(w.coins), badgeX - 8, cy + 2);

  ctx.fillStyle = COLOR.player;
  ctx.font = `${heavy} 34px ${sans}`;
  ctx.fillText('PAUSE', VIEW_W - 112, 132);
  hatch(ctx, VIEW_W - 104, 118, 80, 28, COLOR.player);

  // ---- bottom: the loadout, and the gear --------------------------------
  const stacks = [...w.stacks];
  const th = tilesHeight(stacks.length);
  drawWeaponTiles(ctx, stacks, VIEW_W - 24 - TILES_W, GEAR_BUTTON.y + GEAR_BUTTON.h - th);

  const g = GEAR_BUTTON;
  ctx.fillStyle = COLOR.uiTeal;
  roundRect(ctx, g.x, g.y, g.w, g.h, 12);
  ctx.fill();
  gear(ctx, g.x + g.w / 2, g.y + g.h / 2, 24);

  if (menuOpen) drawMenu(ctx);
}

/** The settings menu. Today it holds the one thing a paused run needs. */
function drawMenu(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(20, 22, 26, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = COLOR.bg;
  roundRect(ctx, MENU.x, MENU.y, MENU.w, MENU.h, 14);
  ctx.fill();

  ctx.fillStyle = COLOR.hud;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 900 28px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('SETTINGS', VIEW_W / 2, MENU.y + 42);

  drawButton(ctx, MENU_END_RUN, {
    label: 'END RUN',
    sub: 'bank your coins and see your score',
    primary: true,
    fontSize: 24,
  });
  drawButton(ctx, MENU_BACK, { label: 'BACK', fontSize: 20 });
}

/** The original's diagonal stripes beside PAUSE. */
function hatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = -h; i < w; i += 11) {
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A white cog: eight teeth round a ring. */
function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.fillRect(-r * 0.2, -r, r * 0.4, r * 0.5);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.uiTeal;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The run's loadout, bottom-left. The original showed the weapon list only on
 * the result screen, which meant you could not tell mid-run what you were
 * holding - and with unbounded stacking that is exactly what you want to know.
 */
/**
 * Short label for a chip. Derived from the id rather than kept in a lookup
 * table, so adding a weapon cannot leave the HUD silently out of sync.
 */
function chipLabel(id: string): string {
  const head = id.split('_')[0];
  return head.length > 7 ? head.slice(0, 7) : head;
}

function drawWeaponChips(ctx: CanvasRenderingContext2D, w: World): void {
  if (w.stacks.size === 0) return;

  // Wrapped rows rather than one chip per line. With all twelve weapons held,
  // a vertical list covered half the play field - including the part where
  // the darkness comes up, which is the last thing you want hidden.
  const padX = 7;
  const chipH = 21;
  const gap = 5;
  const left = 18;
  const right = VIEW_W - 18;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 14px ui-monospace, Menlo, Consolas, monospace';

  type Chip = { text: string; w: number; family: ShotFamily };
  const rows: Chip[][] = [[]];
  let rowW = 0;
  for (const [id, n] of w.stacks) {
    const text = `${chipLabel(id)} ${n}`;
    const cw = ctx.measureText(text).width + padX * 2 + 2;
    if (rowW + cw > right - left && rows[rows.length - 1].length > 0) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push({ text, w: cw, family: weaponFamily(id) });
    rowW += cw + gap;
  }

  let y = VIEW_H - 16 - rows.length * (chipH + gap);
  for (const row of rows) {
    let x = left;
    for (const chip of row) {
      // Opaque, not translucent: these sit low on the screen, which is exactly
      // where the darkness rises, and colour-on-black is unreadable.
      //
      // Each chip wears its shots' colour, so the HUD is the legend for the
      // field. The text takes the DARK shade: amber or ice text on white
      // would be close to invisible, so the bright body colour goes on the
      // bar and the border instead.
      const c = SHOT_COLORS[chip.family];
      ctx.fillStyle = COLOR.bg;
      ctx.fillRect(x, y, chip.w, chipH);
      ctx.strokeStyle = c.body;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, chip.w, chipH);
      ctx.fillStyle = c.body;
      ctx.fillRect(x, y, 4, chipH);
      ctx.fillStyle = c.edge;
      ctx.fillText(chip.text, x + padX + 2, y + chipH / 2 + 1);
      x += chip.w + gap;
    }
    y += chipH + gap;
  }
}
