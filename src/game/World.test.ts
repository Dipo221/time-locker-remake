import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { DARKNESS_BASE_SPEED } from '../config';
import { World } from './World';

const DT = 1 / 60;

/**
 * A scripted clock. The branded dt types exist to stop a SYSTEM reaching for
 * the wrong clock; a test driving the world from outside is the one place
 * allowed to construct them.
 */
function clockFactory(): (ts: number) => Clock {
  let realElapsed = 0;
  let scaledElapsed = 0;
  let frame = 0;
  return (ts: number): Clock => {
    realElapsed += DT;
    scaledElapsed += DT * ts;
    frame++;
    return {
      real: DT as RealDt,
      scaled: (DT * ts) as ScaledDt,
      timeScale: ts,
      realElapsed,
      scaledElapsed,
      frame,
    };
  };
}

const held = (dx: number, dy: number): InputFrame => ({
  holding: true,
  dx,
  dy,
  pathLength: Math.hypot(dx, dy),
  sinceLastMove: 0,
});

const STILL: InputFrame = {
  holding: false,
  dx: 0,
  dy: 0,
  pathLength: 0,
  sinceLastMove: 1,
};

/**
 * The central invariant of the whole game: at timeScale 0 the simulation is
 * absolutely frozen, and the darkness is the single exception.
 *
 * This is worth a test rather than an eyeball because the failure mode is
 * invisible. A bullet creeping a fraction of a pixel per second while
 * "frozen" reads subconsciously as broken long before anyone can name it, and
 * it would be introduced by something as small as one system reading
 * clock.real instead of clock.scaled.
 */
describe('the freeze', () => {
  it('is absolute: nothing in the simulation moves at timeScale 0', () => {
    const w = new World();
    w.reset(99);
    const mk = clockFactory();

    // Build some state: bullets in flight and enemies on screen. The test
    // subject is the freeze, not survival, so keep the scripted player alive -
    // it does not dodge, and the spawn density is tuned for someone who does.
    for (let i = 0; i < 400; i++) {
      w.player.invulnRealFor = 1e9;
      w.update(mk(1), held(Math.cos(i / 9) * 4, 1.2));
    }
    w.player.invulnRealFor = 0;
    expect(w.phase).toBe('playing');
    expect(w.playerShots.count).toBeGreaterThan(0);
    expect(w.enemies.count).toBeGreaterThan(0);

    const snap = (): string =>
      [
        ...Array.from({ length: w.playerShots.count }, (_, i) => {
          const p = w.playerShots.active[i];
          return `${p.x},${p.y}`;
        }),
        ...Array.from({ length: w.enemies.count }, (_, i) => {
          const e = w.enemies.active[i];
          return `${e.x},${e.y}`;
        }),
      ].join('|');

    const before = snap();
    const darkBefore = w.darkness.y;

    // Three real seconds of holding perfectly still.
    for (let i = 0; i < 180; i++) w.update(mk(0), STILL);

    expect(snap(), 'frozen entities must not drift at all').toBe(before);
    expect(w.darkness.y, 'the darkness must NOT freeze').toBeGreaterThan(
      darkBefore,
    );
  });

  it('advances the darkness on real time at its configured base speed', () => {
    const w = new World();
    w.reset(5);
    const mk = clockFactory();

    // Sit inside the catch-up threshold so only the base speed is in play.
    // A run actually STARTS outside it (start gap 700 > catch-up gap 520), so
    // the opening seconds are deliberately a fast close down to equilibrium.
    w.darkness.y = w.player.y - 100;
    const start = w.darkness.y;

    for (let i = 0; i < 120; i++) w.update(mk(0), STILL); // 2 real seconds

    // Score is 0, so the difficulty ramp is exactly 1x.
    expect(w.darkness.y - start).toBeCloseTo(DARKNESS_BASE_SPEED * 2, 1);
  });

  it('eventually swallows a player who never moves', () => {
    const w = new World();
    w.reset(7);
    const mk = clockFactory();

    for (let i = 0; i < 60 * 60 && w.phase === 'playing'; i++) {
      w.update(mk(0), STILL);
    }
    expect(w.phase).not.toBe('playing');
    expect(w.deathCause).toBe('darkness');
  });
});

describe('ending a run by choice', () => {
  it('goes straight to dead, marked as a quit', () => {
    const w = new World();
    w.reset(1);
    w.endRun();
    expect(w.phase).toBe('dead');
    expect(w.deathCause).toBe('quit');
  });

  it('does nothing once the run is already over', () => {
    const w = new World();
    w.reset(1);
    w.kill('contact');
    w.endRun();
    expect(w.phase).toBe('dying');
    expect(w.deathCause).toBe('contact');
  });
});
