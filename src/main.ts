import { ClockSource } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { TimeScaleController } from './core/timeScale';
import { World } from './game/World';
import { DebugOverlay, drawHint } from './render/debugOverlay';
import { drawWorld } from './render/drawWorld';
import {
  PAUSE_BUTTON,
  RESUME_ZONE,
  drawBossBar,
  drawHud,
  drawPauseButton,
  drawPauseOverlay,
} from './render/hud';
import { precompileShapes } from './render/shapePaths';
import { Viewport } from './render/viewport';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#stage canvas not found');
}

// Dev switches until the lobby exists: ?char=wideRhino, ?char=antBear, ?seed=1
const params = new URLSearchParams(location.search);

const vp = new Viewport(canvas);
const input = new Input(vp);
const clock = new ClockSource();
const tsc = new TimeScaleController();
const world = new World(params.get('char') ?? undefined);
const overlay = new DebugOverlay();

const seedParam = params.get('seed');
if (seedParam !== null) world.reset(Number(seedParam) >>> 0);
if (params.get('debug') === '0') overlay.visible = false;

precompileShapes();
input.attach();

// Dev handle: lets the console (and automated checks) assert the core
// invariant directly, e.g. that a frozen projectile's y does not drift while
// darkness.y keeps climbing.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).TL = {
    world,
    clock,
    tsc,
    input,
    vp,
    isPaused: () => paused,
    setPaused: (v: boolean) => setPaused(v),
  };
}

const onResize = (): void => vp.resize();
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(onResize).observe(canvas);
}

/** Press count at the moment of death, so retry needs a FRESH tap. */
let deadAtPress = -1;
/** Hide the control hint once the player has actually dragged. */
let hinted = true;
let paused = false;

function setPaused(v: boolean): void {
  if (v === paused) return;
  if (v && world.phase !== 'playing') return; // nothing to pause
  paused = v;
  // Drop any time-scale momentum, so resuming never carries leftover speed.
  tsc.kill();
}

/**
 * Re-register tap zones every frame, because which zones exist depends on
 * state: a pause button while playing, the whole screen while paused, and
 * none at all when dead (there, tap-to-retry goes through pressCount).
 */
function syncUiRects(): void {
  if (paused) input.setUiRects([RESUME_ZONE]);
  else if (world.phase === 'playing') input.setUiRects([PAUSE_BUTTON]);
  else input.setUiRects([]);
}
syncUiRects();

window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === '~') {
    overlay.visible = !overlay.visible;
    e.preventDefault();
  } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    setPaused(!paused);
    e.preventDefault();
  }
});

// Coming back to a tab mid-run should not drop you straight into a bullet.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

startLoop((realDt) => {
  const frame = input.beginFrame(realDt);
  const tap = input.consumeTap();
  if (tap === 'pause') setPaused(true);
  else if (tap === 'resume') setPaused(false);

  // Untrustworthy input (blur, tab hide): stop dead, no momentum tail.
  if (input.consumeCancel()) tsc.kill();

  if (paused) {
    // A TRUE pause: the clock is not advanced at all, so the darkness and its
    // churning edge stop too. The in-game time freeze deliberately does NOT
    // stop the darkness; if pause behaved the same way it would just be a
    // slower death. Input was already drained above, so no path length banks
    // up and dumps into a timeScale spike on resume.
    tsc.kill();
    drawWorld(vp, world, clock);
    drawHud(vp, world);
    drawPauseOverlay(vp, world);
    overlay.draw(vp, world, tsc, clock);
    syncUiRects();
    return;
  }

  if (hinted && (frame.pathLength > 40 || world.score > 0)) hinted = false;

  let timeScale = tsc.update(
    frame.pathLength,
    frame.holding,
    frame.sinceLastMove,
    realDt,
  );

  // The death hold is the only thing allowed to override player-driven time.
  const override = world.timeScaleOverride();
  if (override !== null) timeScale = override;

  clock.advance(realDt, timeScale);
  world.update(clock, frame);

  if (world.phase === 'dead') {
    if (deadAtPress < 0) deadAtPress = input.pressCount;
    else if (input.pressCount > deadAtPress) {
      world.reset();
      tsc.kill();
      deadAtPress = -1;
    }
  }

  drawWorld(vp, world, clock);
  drawHud(vp, world);
  drawBossBar(vp, world);
  if (world.phase === 'playing') drawPauseButton(vp);
  drawHint(vp, hinted && world.phase === 'playing');
  overlay.sample(clock);
  overlay.draw(vp, world, tsc, clock);
  syncUiRects();
});
