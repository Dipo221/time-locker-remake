import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
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

/** Holding the pointer but not moving it: guns fire, the player stays put. */
const HOLD: InputFrame = { holding: true, dx: 0, dy: 0, pathLength: 6, sinceLastMove: 0 };

function as(character: string): World {
  const w = new World(character);
  w.reset(21);
  return w;
}

/** A tough, stationary target, so the test measures the gun and nothing else. */
function target(w: World, dx: number, dy: number): Enemy {
  const def = ENEMIES.find((e) => e.id === 'bear.black');
  if (def === undefined) throw new Error('no bear');
  const e = w.enemies.spawn();
  if (e === null) throw new Error('pool empty');
  applyDef(e, def);
  e.x = w.player.x + dx;
  e.y = w.player.y + dy;
  e.hp = 500;
  e.maxHp = 500;
  e.archetype = 'turret';
  e.speed = 0;
  e.vx = 0;
  e.vy = 0;
  return e;
}

function run(w: World, seconds: number): void {
  const mk = clockFactory();
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    w.player.invulnRealFor = 1e9;
    w.update(mk(1), HOLD);
  }
}

const hurt = (e: Enemy): boolean => e.hp < 500;

/**
 * Each case runs the mechanic beside a CONTROL that must miss. Without the
 * control, a test that "the auto-aim hit something" passes just as happily
 * when the target was sitting in the ordinary line of fire all along.
 */
describe('auto-aim turrets', () => {
  it('reach an enemy well off to the side that a forward gun misses', () => {
    const control = as('theLocker');
    const c = target(control, 190, 40);
    run(control, 2);
    expect(hurt(c), 'control: a forward gun should not reach it').toBe(false);

    const w = as('autoAimBot');
    const t = target(w, 190, 40);
    run(w, 2);
    expect(hurt(t), 'the turret should swing round onto it').toBe(true);
  });
});

describe('sweeping guns', () => {
  it('cover both flanks over time', () => {
    const control = as('theLocker');
    const cl = target(control, -170, 190);
    const cr = target(control, 170, 190);
    run(control, 4);
    expect(hurt(cl) || hurt(cr), 'control: a fixed gun should miss both').toBe(false);

    const w = as('stegoSaur');
    const l = target(w, -170, 190);
    const r = target(w, 170, 190);
    run(w, 4);
    expect(hurt(l), 'the sweep should cross the left flank').toBe(true);
    expect(hurt(r), 'and the right').toBe(true);
  });
});

describe('bouncing shots', () => {
  it('carry on from one enemy to the next', () => {
    // A directly ahead takes the first hit; B sits well out of the line of
    // fire and can only be reached by a shot that rebounds off A.
    const control = as('theLocker');
    target(control, 0, 200);
    const cb = target(control, 150, 210);
    run(control, 3);
    expect(hurt(cb), 'control: B is out of the line of fire').toBe(false);

    const w = as('gameCast');
    const a = target(w, 0, 200);
    const b = target(w, 150, 210);
    run(w, 3);
    expect(hurt(a)).toBe(true);
    expect(hurt(b), 'the pinball should carry on to B').toBe(true);
  });
});

describe('splitting shots', () => {
  it('burst onto neighbours of whatever they hit', () => {
    const control = as('theLocker');
    target(control, 0, 200);
    const cn = target(control, 46, 200);
    run(control, 2);
    expect(hurt(cn), 'control: the neighbour is out of the line of fire').toBe(false);

    const w = as('penguin');
    const a = target(w, 0, 200);
    const n = target(w, 46, 200);
    run(w, 2);
    expect(hurt(a)).toBe(true);
    expect(hurt(n), 'fragments should reach the neighbour').toBe(true);
  });

  it('never splits its own fragments', () => {
    // A fragment that could split again would cascade until the pool was full.
    const w = as('penguin');
    for (let i = 0; i < 6; i++) target(w, (i - 2.5) * 40, 200);
    run(w, 3);
    expect(w.playerShots.misses, 'a runaway cascade would exhaust the pool').toBe(0);
  });
});

/**
 * The straddle trap, as a rule across the whole roster.
 *
 * GAME CAST was first written with two barrels at +/-8 degrees. That reads as
 * a perfectly sensible twin shot, but at medium range the two streams pass
 * either side of anything directly ahead and hit neither - a character that
 * cannot shoot what is in front of it, with nothing in the data looking wrong.
 * HUSKY had the same flaw. So: everyone must be able to hit a target dead
 * ahead, except the few the source describes as blind there.
 */
describe('every character can hit what is directly ahead', () => {
  /** Blind ahead by design, per the source's own descriptions. */
  const BLIND_AHEAD = new Set([
    'antBear', // no weapon at all
    'backShooter', // rear only
    'beamDragon', // "blind spot straight ahead"
    'hummerHead', // "nothing straight ahead"
    'xShooter', // an X: the gap is the shape
    'xLaser', // likewise
  ]);

  for (const id of Object.keys(CHARACTERS)) {
    if (BLIND_AHEAD.has(id)) continue;
    it(id, () => {
      const w = as(id);
      for (const s of CHARACTERS[id]?.startWeapons ?? []) w.addWeapon(s);
      const t = target(w, 0, 220);
      run(w, 3);
      expect(hurt(t), `${id} cannot hit a target dead ahead`).toBe(true);
    });
  }
});

describe('the air-reach override', () => {
  it('stops PANDA\'s homing bears touching helicopters', () => {
    const w = as('panda');
    const def = ENEMIES.find((e) => e.id === 'heli.black');
    if (def === undefined) throw new Error('no heli');
    const h = w.enemies.spawn();
    if (h === null) throw new Error('pool empty');
    applyDef(h, def);
    h.x = w.player.x;
    h.y = w.player.y + 180;
    h.hp = 500;
    h.archetype = 'turret';
    h.speed = 0;
    h.vx = 0;
    h.vy = 0;
    h.fireCooldown = 1e9;

    run(w, 3);
    // Homing would normally imply air reach; the source says these cannot.
    expect(h.hp).toBe(500);
  });
});
