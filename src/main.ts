import { ClockSource } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { TimeScaleController } from './core/timeScale';
import { World } from './game/World';
import { DebugOverlay, drawHint } from './render/debugOverlay';
import { drawWorld } from './render/drawWorld';
import { drawHud } from './render/hud';
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
  };
}

const onResize = (): void => vp.resize();
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(onResize).observe(canvas);
}

window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === '~') {
    overlay.visible = !overlay.visible;
    e.preventDefault();
  }
});

/** Press count at the moment of death, so retry needs a FRESH tap. */
let deadAtPress = -1;
/** Hide the control hint once the player has actually dragged. */
let hinted = true;

startLoop((realDt) => {
  const frame = input.beginFrame(realDt);

  // Untrustworthy input (blur, tab hide): stop dead, no momentum tail.
  if (input.consumeCancel()) tsc.kill();

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
  drawHint(vp, hinted && world.phase === 'playing');
  overlay.sample(clock);
  overlay.draw(vp, world, tsc, clock);
});
