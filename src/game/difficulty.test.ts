import { describe, expect, it } from 'vitest';
import {
  CAP_LATE_MAX,
  CAP_MAX,
  OBSTACLE_HP_PER_AREA,
  SPAWN_MIN,
  SPAWN_MIN_LATE,
  TOUGHNESS_REF_SCORE,
} from '../config';
import { Rng } from '../core/rng';
import { ENEMIES } from '../data/enemies';
import { BLOCK_LARGE, BLOCK_MEDIUM, BLOCK_SMALL } from '../data/obstacles';
import { toughness } from './difficulty';
import { SpawnDirector } from './SpawnDirector';
import { World } from './World';

/**
 * The late game. Every early difficulty curve tops out by about 2,000
 * points while the player's weapons keep stacking all run; play-testing
 * found a long run with no threat left. These hold the rest of the curve.
 */
describe('difficulty keeps rising after the early game', () => {
  const d = new SpawnDirector();

  it('allows more enemies on screen long after the old cap', () => {
    expect(d.cap(2000)).toBe(CAP_MAX);
    expect(d.cap(20000)).toBeGreaterThan(CAP_MAX + 8);
    expect(d.cap(1e7)).toBe(CAP_LATE_MAX);
    for (let s = 0; s < 60000; s += 500) expect(d.cap(s + 500)).toBeGreaterThanOrEqual(d.cap(s));
  });

  it('keeps spawning faster, down to a late floor', () => {
    expect(d.interval(2000)).toBeCloseTo(SPAWN_MIN, 1);
    expect(d.interval(20000)).toBeLessThan(SPAWN_MIN);
    expect(d.interval(1e7)).toBeCloseTo(SPAWN_MIN_LATE, 5);
  });

  it('toughens enemies along a square root, untouched early', () => {
    expect(toughness(0)).toBe(1);
    expect(toughness(TOUGHNESS_REF_SCORE)).toBe(1);
    expect(toughness(TOUGHNESS_REF_SCORE * 4)).toBeCloseTo(2);
    expect(toughness(TOUGHNESS_REF_SCORE * 16)).toBeCloseTo(4);
  });

  it('herds keep their size, while flocks grow', () => {
    const rng = new Rng(3);
    const size = (id: string, score: number): number =>
      d['groupSize'](ENEMIES.find((e) => e.id === id)!, score, rng);
    for (let i = 0; i < 50; i++) {
      expect(size('bear.herd', 100000)).toBeLessThanOrEqual(5);
      expect(size('mammoth.herd', 100000)).toBeLessThanOrEqual(3);
    }
    expect(size('bird.black', 100000)).toBeGreaterThan(6);
  });

  it('enemies that spawn late really are tougher', () => {
    const w = new World('antBear');
    w.reset(4);
    w.score = TOUGHNESS_REF_SCORE * 16;
    const bear = ENEMIES.find((e) => e.id === 'bear.black')!;
    d['spawn'](w, bear, 5);
    const spawned = w.enemies.active.slice(0, w.enemies.count).filter((e) => e.def === bear);
    expect(spawned.length).toBeGreaterThan(0);
    for (const e of spawned) {
      expect(e.hp).toBe(bear.hp * 4);
      expect(e.maxHp).toBe(e.hp);
    }
  });

  it('saves its heavies for a long run', () => {
    const heavies = ['bear.herd', 'truck', 'tank.column', 'mammoth.herd'];
    for (const id of heavies) {
      const def = ENEMIES.find((e) => e.id === id);
      expect(def, id).toBeDefined();
      expect(def!.minScore, id).toBeGreaterThanOrEqual(4000);
    }
  });
});

describe('obstacles', () => {
  it('take shooting in proportion to their size', () => {
    const area = (s: number): number => (s / 100) ** 2;
    for (const b of [BLOCK_SMALL, BLOCK_MEDIUM, BLOCK_LARGE]) {
      expect(b.hp).toBe(Math.round(OBSTACLE_HP_PER_AREA * area(b.drawSize)));
    }
    expect(BLOCK_LARGE.hp).toBeGreaterThan(BLOCK_MEDIUM.hp * 1.5);
    expect(BLOCK_MEDIUM.hp).toBeGreaterThan(BLOCK_SMALL.hp * 1.5);
  });
});
