import { VIEW_H } from '../config';
import { CHARACTERS } from '../data/characters';
import type { UiRect } from '../core/input';
import { DebugOverlay, drawHint } from '../render/debugOverlay';
import { drawWorld } from '../render/drawWorld';
import {
  GEAR_BUTTON,
  MENU_BACK,
  MENU_END_RUN,
  MENU_OUTSIDE,
  PAUSE_BUTTON,
  RESUME_ZONE,
  drawBossBar,
  drawHud,
  drawPauseButton,
  drawPauseScreen,
} from '../render/hud';
import { buildLobbyFloor, drawLobbyFloor, drawLobbyLabels } from './lobbyFloor';
import type { LobbyFloor } from './lobbyFloor';
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
  /**
   * The lobby floor the run sets off from, and who you were there. Drawn
   * under the run, so the machines are still behind you as you leave.
   */
  private floor: LobbyFloor | null = null;
  private floorCurrent = '';
  /** The gear's settings menu, open over the pause screen. */
  private menuOpen = false;
  private hinted = true;

  enter(ctx: SceneCtx): void {
    const { world, meta } = ctx;

    world.setCharacter(meta.selected);
    const at = ctx.startAt;
    ctx.startAt = null;

    // Only a run you walked into from the lobby is drawn on the lobby floor.
    // RUN AGAIN starts on a bare field: on the floor it looked exactly like
    // the lobby, and a play-tester who landed there (the play button sits
    // beside LOBBY) walked back among the machines thinking they were in the
    // lobby - with the darkness coming up behind them.
    // Built before consumeUse, which can retire a character on its last run.
    this.floor = at === null ? null : buildLobbyFloor(meta);
    this.floorCurrent = meta.selected;
    // A pulled character is spent by playing, not by selecting - so this is
    // the moment the run actually costs one of its three uses.
    meta.consumeUse(meta.selected);

    // Walked in from the lobby: carry on from exactly where they crossed,
    // camera and all, so there is no cut. Otherwise (RUN AGAIN) the run
    // starts where reset() placed it.
    if (at !== null) {
      world.player.x = at.x;
      world.player.y = at.y;
      world.camera.x = at.camX;
      world.camera.y = at.camY;
      world.darkness.reset(at.y);
    }

    // The character's own freebies first, then anything bought in the lobby.
    const def = CHARACTERS[meta.selected];
    for (const id of def?.startWeapons ?? []) world.addWeapon(id);
    for (const id of ctx.pending) world.addWeapon(id);
    ctx.pending = [];

    this.paused = false;
    // Walking in from the lobby, you already know how to move: the lobby
    // taught it. The hint is for a run that starts cold.
    this.hinted = at === null;
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
    this.menuOpen = false;
    ctx.tsc.kill();
  }

  togglePause(ctx: SceneCtx): void {
    this.setPaused(ctx, !this.paused);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private syncRects(ctx: SceneCtx): void {
    // First match wins, so the order is the priority: the menu's buttons
    // before its close-on-outside, and the gear before tap-to-resume.
    const rects: UiRect[] = this.paused
      ? this.menuOpen
        ? [MENU_END_RUN, MENU_BACK, MENU_OUTSIDE]
        : [GEAR_BUTTON, RESUME_ZONE]
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
    else if (tap === 'gear') this.menuOpen = true;
    else if (tap === 'menuBack') this.menuOpen = false;
    else if (tap === 'endRun') {
      // Ends like a death - the result screen banks the coins - but without
      // the death's slow motion, since nothing killed you.
      this.setPaused(ctx, false);
      world.endRun();
      ctx.go('result');
      return;
    }

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
    const { vp, world, clock, tsc, meta } = ctx;
    const floor = this.floor;
    const current = this.floorCurrent;
    // The lobby floor, lettering included, goes in UNDER everything that
    // moves - the player above all - and the darkness covers it as it comes.
    const underlay =
      floor === null
        ? null
        : (c: CanvasRenderingContext2D): void => {
            drawLobbyFloor(c, floor, current);
            if (world.camera.y - VIEW_H / 2 > 200) return;
            c.save();
            vp.applyUi();
            drawLobbyLabels(c, floor, meta, current, world.camera.x, world.camera.y, -Infinity);
            c.restore();
          };
    drawWorld(vp, world, clock, null, underlay);

    if (this.paused) {
      drawPauseScreen(vp, world, meta.highScore, this.menuOpen);
    } else {
      drawHud(vp, world);
      drawBossBar(vp, world);
      if (world.phase === 'playing') drawPauseButton(vp);
      drawHint(vp, this.hinted && world.phase === 'playing');
    }
    this.overlay.draw(vp, world, tsc, clock);
  }
}
