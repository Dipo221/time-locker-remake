import { describe, expect, it } from 'vitest';
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

const STILL: InputFrame = {
  holding: true,
  dx: 0,
  dy: 0,
  pathLength: 6,
  sinceLastMove: 0,
};

function world(...weapons: WeaponId[]): World {
  // ANT BEAR has no gun of its own, so the only fire is what we hand it.
  const w = new World('antBear');
  w.reset(11);
  for (const id of weapons) w.addWeapon(id);
  return w;
}

function place(w: World, id: string, x: number, y: number): Enemy {
  const def = ENEMIES.find((e) => e.id === id);
  if (def === undefined) throw new Error(`no enemy ${id}`);
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, def);
  e.x = x;
  e.y = y;
  return e;
}

function step(w: World, frames: number, keepAlive = true): void {
  const mk = clockFactory();
  for (let i = 0; i < frames; i++) {
    if (keepAlive) w.player.invulnRealFor = 1e9;
    w.update(mk(1), STILL);
  }
}

describe('hopper (frogs)', () => {
  it('sits still, springs, then sits still again', () => {
    const w = world();
    const e = place(w, 'frog.black', w.player.x + 200, w.player.y + 300);
    e.heading = -Math.PI / 2;

    // Mid-pause: the frog should not have moved at all.
    const x0 = e.x;
    const y0 = e.y;
    step(w, 20); // 0.33s, inside a 0.9s pause
    expect(Math.hypot(e.x - x0, e.y - y0), 'still during the pause').toBe(0);

    // Through the rest of the pause and into the hop.
    step(w, 50);
    const moved = Math.hypot(e.x - x0, e.y - y0);
    expect(moved, 'a hop should cover real ground').toBeGreaterThan(40);

    // And it lands: after the hop the frog is still again.
    step(w, 25);
    const x1 = e.x;
    const y1 = e.y;
    step(w, 10);
    expect(Math.hypot(e.x - x1, e.y - y1), 'landed, sitting again').toBe(0);
  });
});

/**
 * The snake and the trailer are threatening because of their LENGTH. If
 * collision only looked at the head - the natural first implementation - you
 * could brush straight through the body and nothing would happen, and no
 * test of the head alone would ever notice.
 */
describe('long bodies', () => {
  it('kill along the whole body, not just at the head', () => {
    const w = world();
    const e = place(w, 'snake.black', w.player.x, w.player.y + 260);
    e.archetype = 'turret'; // hold still so the geometry is exact
    e.speed = 0;
    e.vx = 0;
    e.vy = 0;
    // Facing straight down, so the body trails straight up from the head.
    e.angle = Math.PI;

    // Stand on the body, well away from the head.
    w.player.x = e.x;
    w.player.y = e.y + e.length * 0.8;
    step(w, 1, false);

    expect(w.phase, 'touching the tail must be fatal').not.toBe('playing');
  });

  it('are harmless just beside the body', () => {
    const w = world();
    const e = place(w, 'snake.black', w.player.x, w.player.y + 260);
    e.archetype = 'turret';
    e.speed = 0;
    e.vx = 0;
    e.vy = 0;
    e.angle = Math.PI;

    w.player.x = e.x + 90;
    w.player.y = e.y + e.length * 0.8;
    step(w, 1, false);

    expect(w.phase).toBe('playing');
  });
});

/**
 * Flying is three rules at once - only homing reaches it, touching it is
 * safe, and its bombs are ground fire - and each can be broken without the
 * others noticing.
 */
describe('air units', () => {
  function heli(w: World): Enemy {
    const e = place(w, 'heli.black', w.player.x, w.player.y + 200);
    e.archetype = 'turret';
    e.speed = 0;
    e.vx = 0;
    e.vy = 0;
    e.hp = 50;
    e.maxHp = 50;
    return e;
  }

  it('are out of reach of ordinary fire', () => {
    const w = world('TWIN_SHOT', 'TWIN_SHOT', 'WIDE_SHOT');
    const e = heli(w);
    step(w, 120);
    expect(e.hp, 'straight shots must pass under it').toBe(50);
  });

  it('can be hit by homing weapons', () => {
    const w = world('HOMING_SHOT', 'HOMING_SHOT');
    const e = heli(w);
    step(w, 180);
    expect(e.hp).toBeLessThan(50);
  });

  it('are harmless to touch - directly beneath is safe', () => {
    const w = world();
    const e = heli(w);
    // Clear its bombs out of the way so only the body is being tested.
    e.fireCooldown = 1e9;
    w.player.x = e.x;
    w.player.y = e.y;
    step(w, 10, false);
    expect(w.phase).toBe('playing');
  });

  it('bomb whatever is underneath them, bosses included', () => {
    const w = world();
    const e = heli(w);
    e.heading = -Math.PI / 2; // bombs travel straight down
    e.fireCooldown = 0;
    // Keep the player well out of the way.
    w.player.x = 40;

    const ground = place(w, 'bear.black', e.x, e.y - 120);
    ground.archetype = 'turret';
    ground.speed = 0;
    ground.vx = 0;
    ground.vy = 0;
    ground.hp = 99;

    step(w, 90);
    expect(ground.hp, 'its bombs are ground fire').toBeLessThan(99);
  });
});

describe('stationary enemies', () => {
  it('always spawn ahead, never stranded off to one side', () => {
    const w = world();
    w.score = 5000; // late enough that side spawns are in play
    const mk = clockFactory();
    for (let i = 0; i < 60 * 40; i++) {
      w.player.invulnRealFor = 1e9;
      w.update(mk(1), { ...STILL, dy: 1.3 });
      for (let j = 0; j < w.enemies.count; j++) {
        const e = w.enemies.active[j];
        // Obstacles are terrain spread across the whole corridor on purpose;
        // the rule here is about turrets that would sit unseen.
        if (e.archetype !== 'turret' || e.isBoss || e.solid) continue;
        const sx = e.x - w.camera.x;
        expect(sx, `${e.def.id} placed off to the side`).toBeGreaterThan(-1);
        expect(sx).toBeLessThan(541);
      }
    }
  });
});
