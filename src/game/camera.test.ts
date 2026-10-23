import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { PLAY_MARGIN, VIEW_W, WORLD_W } from '../config';
import { World } from './World';

const DT = 1 / 60;

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

const push = (dx: number): InputFrame => ({
  holding: true,
  dx,
  dy: 1.2,
  pathLength: Math.hypot(dx, 1.2),
  sinceLastMove: 0,
});

function shove(w: World, dx: number, seconds = 4): void {
  const mk = clockFactory();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.player.invulnRealFor = 1e9;
    w.update(mk(1), push(dx));
  }
}

/**
 * The playfield is wider than the view, so the camera pans sideways. Two
 * things have to hold together, and they pull against each other: the player
 * must be able to use the whole width, AND the wall they are heading for must
 * actually become visible - otherwise they discover an edge by bumping into
 * one they could not see.
 *
 * A dead-zone camera satisfies the first and quietly fails the second, which
 * is why the follow is a linear mapping instead.
 */
describe('the playfield is wider than the view', () => {
  it('lets the player past the screen edges', () => {
    expect(WORLD_W).toBeGreaterThan(VIEW_W);

    const w = new World();
    w.reset(1);
    shove(w, 9);
    expect(w.player.x, 'should reach beyond one screen width').toBeGreaterThan(
      VIEW_W,
    );
  });

  it('keeps the player inside the world', () => {
    const right = new World();
    right.reset(1);
    shove(right, 9);
    expect(right.player.x).toBeLessThanOrEqual(WORLD_W - PLAY_MARGIN + 0.001);

    const left = new World();
    left.reset(1);
    shove(left, -9);
    expect(left.player.x).toBeGreaterThanOrEqual(PLAY_MARGIN - 0.001);
  });

  it('brings each wall fully into view when you reach it', () => {
    const span = WORLD_W - VIEW_W;

    const left = new World();
    left.reset(1);
    shove(left, -9);
    // camera.x is the world X at the left edge of the view, so 0 means the
    // left wall is exactly on screen.
    expect(left.camera.x).toBeCloseTo(0, 0);

    const right = new World();
    right.reset(1);
    shove(right, 9);
    expect(right.camera.x).toBeCloseTo(span, 0);
  });

  it('never lets the player off screen', () => {
    const w = new World();
    w.reset(1);
    const mk = clockFactory();
    // Sweep back and forth across the whole width.
    for (let i = 0; i < 60 * 12; i++) {
      w.player.invulnRealFor = 1e9;
      w.update(mk(1), push(Math.sin(i / 70) * 9));
      const sx = w.player.x - w.camera.x;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(VIEW_W);
    }
  });
});
