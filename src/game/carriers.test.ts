import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { WEAPON_CARRIER_WEIGHT } from '../config';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from './entities/Enemy';
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

const STILL: InputFrame = {
  holding: true,
  dx: 0,
  dy: 0,
  pathLength: 6,
  sinceLastMove: 0,
};

/**
 * Watches a long run at score 0 and reports every group that spawned, as
 * the list of its members. ANT BEAR has no gun, so nothing gets shot down
 * before it is seen.
 */
function watchGroups(frames: number): Enemy[][] {
  const w = new World('antBear');
  w.reset(3);
  const mk = clockFactory();
  const seen = new Set<Enemy>();
  const groups: Enemy[][] = [];

  for (let i = 0; i < frames; i++) {
    w.player.invulnRealFor = 1e9;
    w.darkness.y = w.player.y - 600;
    w.score = 0;
    w.update(mk(1), STILL);

    const fresh: Enemy[] = [];
    for (let j = 0; j < w.enemies.count; j++) {
      const e = w.enemies.active[j];
      if (e.solid || e.isBoss || seen.has(e)) continue;
      seen.add(e);
      fresh.push(e);
    }
    if (fresh.length > 0) groups.push(fresh);
    // Pool objects are recycled; forget the ones that left.
    for (const e of seen) if (!e.alive) seen.delete(e);
  }
  return groups;
}

describe('weapon carriers', () => {
  it('no enemy is a weapon box of its own', () => {
    for (const e of ENEMIES) {
      expect(e.drop, e.id).not.toBe('weapon');
      expect(e.colorRole, e.id).not.toBe('blue');
    }
  });

  const groups = watchGroups(60 * 240);
  const carriers = groups.flat().filter((e) => e.drop === 'weapon');

  it('is one blue member of an ordinary group, in its own kind\'s shape', () => {
    expect(carriers.length).toBeGreaterThan(5);
    for (const g of groups) {
      expect(g.filter((e) => e.drop === 'weapon').length).toBeLessThanOrEqual(1);
    }
    for (const c of carriers) {
      expect(c.colorRole).toBe('blue');
      expect(c.flying).toBe(false);
      // Spawned as a regular roster type: only the colour and drop changed.
      expect(c.def.drop).toBe('none');
      expect(c.shape).toBe(c.def.shape);
    }
    // And sometimes it is the odd one out in a real flock.
    expect(groups.some((g) => g.length > 1 && g.some((e) => e.drop === 'weapon'))).toBe(true);
  });

  it('arrives as often as the old crate did', () => {
    // At score 0 the crate took WEAPON_CARRIER_WEIGHT out of every roll's
    // total. Carriers per group should match that share.
    let total = 0;
    for (const e of ENEMIES) if (e.minScore <= 0) total += e.spawnWeight;
    const share = WEAPON_CARRIER_WEIGHT / (total + WEAPON_CARRIER_WEIGHT);

    const rate = carriers.length / groups.length;
    expect(rate).toBeGreaterThan(share * 0.6);
    expect(rate).toBeLessThan(share * 1.4);
  });
});
