import { ClockSource } from './core/clock';
import { Input } from './core/input';
import { startLoop } from './core/loop';
import { Rng } from './core/rng';
import { TimeScaleController } from './core/timeScale';
import { MetaState, loadMeta, saveMeta } from './game/MetaState';
import { World } from './game/World';
import { precompileShapes } from './render/shapePaths';
import { Viewport } from './render/viewport';
import { GameScene } from './scenes/gameScene';
import { LobbyScene } from './scenes/lobbyScene';
import { ResultScene } from './scenes/resultScene';
import { SceneManager } from './scenes/scene';
import type { SceneCtx, SceneId } from './scenes/scene';

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#stage canvas not found');
}

// Dev switches: ?char=wideRhino, ?seed=1, ?debug=0, ?scene=game, ?wipe=1
const params = new URLSearchParams(location.search);

const vp = new Viewport(canvas);
const input = new Input(vp);
const clock = new ClockSource();
const tsc = new TimeScaleController();
const meta = new MetaState();
const world = new World();
const rng = new Rng((Math.random() * 0xffffffff) >>> 0);

if (params.get('wipe') !== '1') loadMeta(meta);

// Dev builds only: in a published build this would be a free-characters cheat.
const charParam = import.meta.env.DEV ? params.get('char') : null;
if (charParam !== null) {
  // Dev convenience: hand the character over outright so it can be tried.
  meta.grant(charParam, 99);
  meta.selected = charParam;
}
const seedParam = params.get('seed');
if (seedParam !== null) rng.reseed(Number(seedParam) >>> 0);

const lobby = new LobbyScene();
const game = new GameScene();
const result = new ResultScene();
// A published build opens clean, with the debug panel off unless asked for.
// On a phone there is no backquote key to hide it, and on some hosts the
// query string never reaches the page at all, so off has to be the default.
game.overlay.visible = import.meta.env.DEV
  ? params.get('debug') !== '0'
  : params.get('debug') === '1';

const ctx: SceneCtx = {
  vp,
  input,
  clock,
  tsc,
  meta,
  world,
  rng,
  pending: [],
  go(id: SceneId) {
    manager.request(id);
  },
};

const manager = new SceneManager(
  { lobby, game, result },
  ctx,
  (import.meta.env.DEV ? (params.get('scene') as SceneId | null) : null) ??
    'lobby',
);

precompileShapes();
input.attach();

// Dev handle: lets the console assert the core invariants directly, e.g. that
// a frozen projectile's y does not drift while darkness.y keeps climbing.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).TL = {
    world,
    clock,
    tsc,
    input,
    vp,
    meta,
    manager,
    scenes: { lobby, game, result },
    isPaused: () => game.isPaused,
    setPaused: (v: boolean) => game.setPaused(ctx, v),
  };
}

const onResize = (): void => vp.resize();
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(onResize).observe(canvas);
}

window.addEventListener('keydown', (e) => {
  // Typing a save code must not pause the game or have its keys swallowed.
  const t = e.target;
  if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return;
  if (e.key === '`' || e.key === '~') {
    game.overlay.visible = !game.overlay.visible;
    e.preventDefault();
  } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (manager.id === 'game') game.togglePause(ctx);
    e.preventDefault();
  }
});

// Coming back to a tab mid-run should not drop you straight into a bullet.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (manager.id === 'game') game.setPaused(ctx, true);
  saveMeta(meta);
});

window.addEventListener('pagehide', () => saveMeta(meta));

startLoop((realDt) => {
  manager.frame(realDt);
});
