import { CHARACTERS } from '../data/characters';
import type { UiRect } from '../core/input';
import { DebugOverlay, drawHint } from '../render/debugOverlay';
import { drawWorld } from '../render/drawWorld';
import {
  PAUSE_BUTTON,
  RESUME_ZONE,
  drawBossBar,
  drawHud,
  drawPauseButton,
  drawPauseOverlay,
} from '../render/hud';
import type { Scene, SceneCtx } from './scene';

/**
 * The run itself. Everything here was previously the body of main's loop;
 * moving it behind the Scene interface is what lets the lobby exist without
 * the two fighting over the frame.
 */
export class GameScene implements Scene {
  readonly id = 'game' as const;
  readonly overlay = new DebugOverlay();

  private paused = false;
  private hinted = true;

  enter(ctx: SceneCtx): void {
    const { world, meta } = ctx;

    world.setCharacter(meta.selected);
    // A pulled character is spent by playing, not by selecting - so this is
    // the moment the run actually costs one of its three uses.
    meta.consumeUse(meta.selected);

    // The character's own freebies first, then anything bought in the lobby.
    const def = CHARACTERS[meta.selected];
    for (const id of def?.startWeapons ?? []) world.addWeapon(id);
    for (const id of ctx.pending) world.addWeapon(id);
    ctx.pending = [];

    this.paused = false;
    this.hinted = true;
    ctx.tsc.kill();
    this.syncRects(ctx);
  }

  exit(ctx: SceneCtx): void {
    ctx.input.setUiRects([]);
  }

  setPaused(ctx: SceneCtx, v: boolean): void {
    if (v === this.paused) return;
    if (v && ctx.world.phase !== 'playing') return;
    this.paused = v;
    ctx.tsc.kill();
  }

  togglePause(ctx: SceneCtx): void {
    this.setPaused(ctx, !this.paused);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private syncRects(ctx: SceneCtx): void {
    const rects: UiRect[] = this.paused
      ? [RESUME_ZONE]
      : ctx.world.phase === 'playing'
        ? [PAUSE_BUTTON]
        : [];
    ctx.input.setUiRects(rects);
  }

  update(ctx: SceneCtx, realDt: number): void {
    const { input, world, clock, tsc } = ctx;
    const frame = input.beginFrame(realDt);

    const tap = input.consumeTap();
    if (tap === 'pause') this.setPaused(ctx, true);
    else if (tap === 'resume') this.setPaused(ctx, false);

    if (input.consumeCancel()) tsc.kill();

    if (this.paused) {
      // A TRUE pause: the clock is not advanced at all, so the darkness and
      // its churning edge stop too. The in-game time freeze deliberately does
      // NOT stop the darkness; a pause that behaved the same way would just
      // be a slower death. Input was drained above, so no path length banks
      // up and dumps into a timeScale spike on resume.
      tsc.kill();
      this.syncRects(ctx);
      return;
    }

    if (this.hinted && (frame.pathLength > 40 || world.score > 0)) {
      this.hinted = false;
    }

    let timeScale = tsc.update(
      frame.pathLength,
      frame.holding,
      frame.sinceLastMove,
      realDt,
    );
    const override = world.timeScaleOverride();
    if (override !== null) timeScale = override;

    clock.advance(realDt, timeScale);
    world.update(clock, frame);

    this.overlay.sample(clock);
    this.syncRects(ctx);

    if (world.phase === 'dead') ctx.go('result');
  }

  render(ctx: SceneCtx): void {
    const { vp, world, clock, tsc } = ctx;
    drawWorld(vp, world, clock);
    drawHud(vp, world);
    drawBossBar(vp, world);

    if (this.paused) {
      drawPauseOverlay(vp, world);
    } else {
      if (world.phase === 'playing') drawPauseButton(vp);
      drawHint(vp, this.hinted && world.phase === 'playing');
    }
    this.overlay.draw(vp, world, tsc, clock);
  }
}
