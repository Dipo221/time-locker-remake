import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { BOSS_GAP_MAX, VIEW_H } from '../config';
import { BOSSES } from '../data/bosses';
import type { Enemy } from './entities/Enemy';
import { applyDef } from './entities/Enemy';
import { World } from './World';
import { killEnemy } from './systems/damage';

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

function spawnBoss(w: World, id: string, invincible = false): Enemy {
  const def = BOSSES.find((b) => b.id === id);
  if (def === undefined) throw new Error(`no boss ${id}`);
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, def);
  e.x = 270;
  e.y = w.player.y + 250;
  // These cases are about pursuit, not combat. Left killable, the boss now
  // catches up, ends up in front of the player's guns, and dies - which is the
  // fix working, but it would leave the test unable to tell "beaten" from
  // "silently culled", which is the thing it exists to catch.
  if (invincible) e.hp = 1e9;
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
      const boss = spawnBoss(w, def.id, true);

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
    const boss = spawnBoss(w, 'boss.dino', true);

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
    if (first !== null) killEnemy(w, first);
    w.enemies.compact();

    // Earn well past the new threshold; the follow-up should then arrive.
    w.score = w.nextBossScore + 1;
    for (let i = 0; i < 10; i++) w.update(mk(1), sprint(100));
    expect(w.bossesSpawned).toBeGreaterThan(spawnedAfterFirst);
  });
});

/**
 * The spacing rule, which is what a player actually feels.
 *
 * The first implementation used an absolute schedule (500, 1250, 2000, ...).
 * That reads fine until you notice score accrues faster and faster: late in a
 * run one boss fight earns more than the whole interval, so the next boss was
 * due the instant the last died. Play-testing reported exactly that. Spacing
 * is now measured forward from the kill, which is the only version that
 * guarantees a breather regardless of how fast points are coming in.
 */
describe('boss spacing', () => {
  function beatABoss(w: World, mk: (ts: number) => Clock, atScore: number): void {
    w.score = atScore;
    w.update(mk(1), sprint(100));
    const boss = w.bossAlive();
    expect(boss).not.toBeNull();
    if (boss !== null) killEnemy(w, boss);
    w.enemies.compact();
  }

  it('always leaves a gap after a kill, however fast points are coming in', () => {
    // 12000 is deep into a run, where the old absolute schedule collapsed.
    for (const atScore of [500, 3000, 12000]) {
      const w = new World();
      w.reset(3);
      const mk = clockFactory();
      beatABoss(w, mk, atScore);

      const scoreAfterKill = w.score;
      expect(
        w.nextBossScore - scoreAfterKill,
        `needs real breathing room at score ${atScore}`,
      ).toBeGreaterThan(250);

      // Standing exactly where the fight ended must not trigger the next one.
      for (let i = 0; i < 120; i++) w.update(mk(1), sprint(100));
      expect(w.countBosses(), `a boss came straight back at ${atScore}`).toBe(0);
    }
  });

  it('only allows concurrent bosses once several have been beaten', () => {
    const w = new World();
    w.reset(3);
    expect(w.spawner.maxConcurrentBosses(0)).toBe(1);
    expect(w.spawner.maxConcurrentBosses(4)).toBe(1);
    expect(w.spawner.maxConcurrentBosses(5)).toBe(2);
    expect(w.spawner.maxConcurrentBosses(50)).toBe(3);
  });

  it('saturates the gap rather than growing it without bound', () => {
    // The measured score rate plateaus, so the gap must too, or late bosses
    // would get rarer and rarer.
    const w = new World();
    w.reset(3);
    w.score = 5000;
    const mid = w.bossGap();
    w.score = 60000;
    expect(w.bossGap()).toBe(BOSS_GAP_MAX);
    expect(mid).toBeLessThanOrEqual(BOSS_GAP_MAX);
  });
});
