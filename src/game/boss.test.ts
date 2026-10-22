import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { VIEW_H } from '../config';
import { BOSSES } from '../data/bosses';
import type { Enemy } from './entities/Enemy';
import { applyDef } from './entities/Enemy';
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

const sprint = (speed: number): InputFrame => ({
  holding: true,
  dx: 0,
  dy: speed * DT,
  pathLength: speed * DT,
  sinceLastMove: 0,
});

function spawnBoss(w: World, id: string): Enemy {
  const def = BOSSES.find((b) => b.id === id);
  if (def === undefined) throw new Error(`no boss ${id}`);
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, def);
  e.x = 270;
  e.y = w.player.y + 250;
  e.maxHp = e.hp;
  return e;
}

/**
 * Bosses never despawn, so the thing that must not happen is a boss being left
 * behind and becoming permanently unreachable. That is not hypothetical: a
 * play-test outran a T-Rex, and because the scheduler will not start a new
 * boss while one is alive, the remaining several thousand points of that run
 * had no bosses at all. The failure was silent - nothing crashed, the game
 * just quietly lost a whole category of content.
 */
describe('a boss cannot be escaped for good', () => {
  for (const def of BOSSES) {
    it(`${def.displayName} closes back in on a sprinting player`, () => {
      const w = new World();
      w.reset(4);
      const mk = clockFactory();
      const boss = spawnBoss(w, def.id);

      // Sprint flat out for 20 seconds. 700 u/s is beyond what a player
      // sustains in practice: holding the time scale at its ceiling is ~600.
      for (let i = 0; i < 60 * 20; i++) {
        w.player.invulnRealFor = 1e9;
        w.update(mk(1), sprint(700));
      }

      expect(boss.alive, 'the boss must not quietly vanish').toBe(true);
      const gap = Math.hypot(boss.x - w.player.x, boss.y - w.player.y);
      expect(gap, 'should have closed back to roughly a screen').toBeLessThan(
        VIEW_H,
      );
    });
  }

  it('is never left buried inside the darkness', () => {
    const w = new World();
    w.reset(5);
    const mk = clockFactory();
    const boss = spawnBoss(w, 'boss.dino');

    for (let i = 0; i < 60 * 15; i++) {
      w.player.invulnRealFor = 1e9;
      w.update(mk(1), sprint(700));
      expect(boss.y).toBeGreaterThanOrEqual(w.darkness.y);
    }
  });

  it('does not block the schedule once beaten', () => {
    const w = new World();
    w.reset(6);
    const mk = clockFactory();

    w.score = 10000;
    w.update(mk(1), sprint(100));
    const first = w.bossAlive();
    expect(first, 'a boss is due at this score').not.toBeNull();

    const spawnedAfterFirst = w.bossesSpawned;
    if (first !== null) first.alive = false;
    w.enemies.compact();

    // Well past the next threshold, so the follow-up is immediately due.
    for (let i = 0; i < 10; i++) w.update(mk(1), sprint(100));
    expect(w.bossesSpawned).toBeGreaterThan(spawnedAfterFirst);
  });
});
