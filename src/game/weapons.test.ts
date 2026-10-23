import { beforeEach, describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from './entities/Enemy';
import { applyDef } from './entities/Enemy';
import { World } from './World';
import type { WeaponId } from './weapons/types';

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

/** Moving, so guns fire, but barely - we do not want to wander off target. */
const NUDGE: InputFrame = {
  holding: true,
  dx: 0,
  dy: 0.35,
  pathLength: 6,
  sinceLastMove: 0,
};

/**
 * ANT BEAR has no innate weapon at all, which makes it the only way to test a
 * single weapon in isolation - with any other character the base shot would
 * be doing damage alongside whatever is under test.
 */
function armedWith(...weapons: WeaponId[]): World {
  const w = new World('antBear');
  w.reset(7);
  for (const id of weapons) w.addWeapon(id);
  w.player.invulnRealFor = 1e9; // these tests are about weapons, not dying
  return w;
}

function place(w: World, id: string, x: number, y: number, hp = 99): Enemy {
  const def = ENEMIES.find((e) => e.id === id);
  if (def === undefined) throw new Error(`no enemy ${id}`);
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, def);
  e.x = x;
  e.y = y;
  e.hp = hp;
  e.maxHp = hp;
  e.speed = 0;
  e.vx = 0;
  e.vy = 0;
  e.archetype = 'turret'; // hold still so the test measures the weapon
  return e;
}

/**
 * Enemies are pooled, so a dead one's slot is reused within a frame or two by
 * whatever the spawn director produces next - at which point `e.alive` reads
 * true again for a completely different enemy. Checking the generation is the
 * only way to ask "is the one I was watching gone?". A first draft of these
 * tests got this wrong and reported a working MINE BOT as broken.
 */
function isGone(e: Enemy, gen: number): boolean {
  return !e.alive || e.gen !== gen;
}

function run(w: World, seconds: number): void {
  const mk = clockFactory();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.player.invulnRealFor = 1e9;
    w.update(mk(1), NUDGE);
  }
}

describe('ICE CANON', () => {
  it('freezes without dealing damage', () => {
    const w = armedWith('ICE_CANON');
    const e = place(w, 'bear.black', w.player.x, w.player.y + 140);
    const hp0 = e.hp;

    run(w, 1.2);

    expect(e.frozenFor, 'should have been frozen').toBeGreaterThan(0);
    expect(e.hp, 'ICE CANON is rated zero damage').toBe(hp0);
  });

  it('leaves a frozen enemy lethal on contact', () => {
    // The source is explicit about this and it is the rule that catches
    // people out: freezing a crowd leaves a field of stationary landmines.
    const w = armedWith('ICE_CANON');
    const e = place(w, 'bear.black', w.player.x, w.player.y + 140);
    run(w, 1.2);
    expect(e.frozenFor).toBeGreaterThan(0);

    w.player.invulnRealFor = 0;
    w.player.x = e.x;
    w.player.y = e.y;
    const mk = clockFactory();
    w.update(mk(1), NUDGE);

    expect(w.phase).not.toBe('playing');
  });
});

describe('BEAM', () => {
  it('pierces a whole line of enemies with one shot', () => {
    const w = armedWith('BEAM');
    const a = place(w, 'penguin.black', w.player.x, w.player.y + 120);
    const b = place(w, 'penguin.black', w.player.x, w.player.y + 220);
    const c = place(w, 'penguin.black', w.player.x, w.player.y + 320);

    run(w, 0.8);

    expect(a.hp).toBeLessThan(99);
    expect(b.hp).toBeLessThan(99);
    expect(c.hp, 'the third in line must also be hit').toBeLessThan(99);
  });
});

describe('ROCKET', () => {
  it('splashes onto a neighbour it never touched', () => {
    const w = armedWith('ROCKET');
    // Directly in the firing line, and a bystander just beside it.
    const hit = place(w, 'bear.black', w.player.x, w.player.y + 200);
    const bystander = place(w, 'bear.black', w.player.x + 46, w.player.y + 200);

    run(w, 1.5);

    expect(hit.hp).toBeLessThan(99);
    expect(bystander.hp, 'blast should reach it').toBeLessThan(99);
  });
});

describe('HOMING SHOT', () => {
  it('curves toward an enemy that is not in front', () => {
    const w = armedWith('HOMING_SHOT');
    const e = place(w, 'bear.black', w.player.x + 150, w.player.y + 40);

    run(w, 2.0);

    expect(e.hp, 'a straight shot would have missed entirely').toBeLessThan(99);
  });
});

describe('MISSILE', () => {
  it('chases and then explodes', () => {
    const w = armedWith('MISSILE');
    const e = place(w, 'bear.black', w.player.x + 120, w.player.y + 160);
    const bystander = place(w, 'bear.black', w.player.x + 150, w.player.y + 190);

    run(w, 2.5);

    expect(e.hp).toBeLessThan(99);
    expect(bystander.hp, 'blast should reach the neighbour').toBeLessThan(99);
  });
});

describe('LINE', () => {
  it('puts out far more fire than TWIN SHOT', () => {
    const line = armedWith('LINE');
    const twin = armedWith('TWIN_SHOT');
    run(line, 1);
    run(twin, 1);
    expect(line.playerShots.count).toBeGreaterThan(twin.playerShots.count);
  });
});

describe('companions', () => {
  let w: World;

  beforeEach(() => {
    w = armedWith();
  });

  it('GUARD BIT orbits the player and grinds what it touches', () => {
    w.addWeapon('GUARD_BIT');
    run(w, 0.2);
    expect(w.drones.count, 'one drone per stack').toBe(1);

    const d = w.drones.active[0];
    const r = Math.hypot(d.x - w.player.x, d.y - w.player.y);
    expect(r, 'should sit on its orbit').toBeGreaterThan(20);
    expect(r).toBeLessThan(90);

    // Park an enemy right on the ring.
    const e = place(w, 'bear.black', d.x, d.y);
    run(w, 1.0);
    expect(e.hp).toBeLessThan(99);
  });

  it('MINE BOT launches at a nearby enemy and detonates', () => {
    w.addWeapon('MINE_BOT');
    run(w, 0.2);
    expect(w.drones.count).toBe(1);

    const e = place(w, 'penguin.black', w.player.x + 90, w.player.y + 60, 2);
    const gen = e.gen;
    run(w, 1.5);

    expect(isGone(e, gen), 'the mine should have killed it').toBe(true);
  });

  it('SUPPORTER shoots at enemies while it orbits', () => {
    w.addWeapon('SUPPORTER');
    // Asserting on damage rather than on live shot count: its shots are
    // consumed the moment they land, so counting them is a race.
    const e = place(w, 'bear.black', w.player.x + 60, w.player.y + 200);
    run(w, 2.0);

    expect(w.drones.count).toBe(1);
    expect(
      e.hp,
      'ANT BEAR has no gun, so any damage is the SUPPORTER',
    ).toBeLessThan(99);
  });

  it('gives one companion per stack held', () => {
    w.addWeapon('GUARD_BIT');
    w.addWeapon('GUARD_BIT');
    w.addWeapon('GUARD_BIT');
    run(w, 0.3);
    expect(w.drones.count).toBe(3);
  });
});
