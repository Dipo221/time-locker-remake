import { COLOR, VIEW_H, VIEW_W } from '../config';
import type { UiRect } from '../core/input';
import { saveMeta } from '../game/MetaState';
import { drawWorld } from '../render/drawWorld';
import { drawButton, label, mono } from '../render/ui';
import type { Scene, SceneCtx } from './scene';

const AGAIN: UiRect = { id: 'again', x: 50, y: 600, w: VIEW_W - 100, h: 70 };
const LOBBY: UiRect = { id: 'lobby', x: 50, y: 686, w: VIEW_W - 100, h: 58 };

/**
 * End of a run: what you scored, what you banked, and where to next.
 *
 * Banking happens exactly once, on entry, so coins cannot be collected twice
 * by lingering here.
 */
export class ResultScene implements Scene {
  readonly id = 'result' as const;

  private score = 0;
  private coins = 0;
  private best = false;

  enter(ctx: SceneCtx): void {
    const { world, meta } = ctx;
    this.score = world.score;
    this.coins = world.coins;
    this.best = world.score > meta.highScore;

    meta.bankRun(world.score, world.coins);
    saveMeta(meta);

    ctx.input.setUiRects([AGAIN, LOBBY]);
  }

  exit(ctx: SceneCtx): void {
    ctx.input.setUiRects([]);
  }

  update(ctx: SceneCtx, realDt: number): void {
    // Drain input so nothing banks up for the next scene.
    ctx.input.beginFrame(realDt);
    ctx.input.consumeCancel();

    const tap = ctx.input.consumeTap();
    if (tap === 'again') {
      ctx.world.reset();
      ctx.go('game');
    } else if (tap === 'lobby') {
      ctx.go('lobby');
    }
  }

  render(ctx: SceneCtx): void {
    const { vp, world, clock, meta } = ctx;
    const c = vp.ctx;

    // The battlefield stays behind the card, frozen where it stopped.
    drawWorld(vp, world, clock);

    vp.applyUi();
    c.save();
    c.beginPath();
    c.rect(0, 0, VIEW_W, VIEW_H);
    c.clip();

    c.fillStyle = 'rgba(250, 249, 247, 0.93)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    label(
      c,
      world.deathCause === 'darkness' ? 'SWALLOWED' : 'DESTROYED',
      VIEW_W / 2,
      250,
      30,
      COLOR.hudDim,
      'center',
    );
    label(c, String(this.score), VIEW_W / 2, 320, 76, COLOR.hud, 'center');

    if (this.best) {
      label(c, 'NEW BEST', VIEW_W / 2, 378, 20, COLOR.playerShot, 'center');
    } else {
      mono(c, `best ${meta.highScore}`, VIEW_W / 2, 378, 17, COLOR.hudDim, 'center');
    }

    mono(c, `+${this.coins} COINS`, VIEW_W / 2, 440, 24, COLOR.playerShot, 'center');
    mono(c, `bank ${meta.coins}`, VIEW_W / 2, 472, 16, COLOR.hudDim, 'center');

    drawButton(c, AGAIN, { label: 'RUN AGAIN', primary: true, fontSize: 25 });
    drawButton(c, LOBBY, { label: 'LOBBY', fontSize: 20 });

    c.restore();
  }
}
