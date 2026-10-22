import { COLOR, VIEW_H, VIEW_W } from '../config';
import type { World } from '../game/World';
import type { Viewport } from './viewport';

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
