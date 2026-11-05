import { describe, expect, it } from 'vitest';
import type { Clock, RealDt, ScaledDt } from '../core/clock';
import type { InputFrame } from '../core/input';
import {
  COIN_VALUE,
  OBSTACLE_PASSAGE,
  PLAYER_SOLID_RADIUS_FRAC,
  VIEW_H,
  WORLD_W,
} from '../config';
import type { EnemyDef } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import { BLOCK_LARGE, TREE, greenVariant } from '../data/obstacles';
import type { Enemy } from './entities/Enemy';
import { applyDef } from './entities/Enemy';
import { damageEnemy } from './systems/damage';
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

function drag(dx: number, dy: number): InputFrame {
  return { holding: true, dx, dy, pathLength: 6, sinceLastMove: 0 };
}

function world(...weapons: WeaponId[]): World {
  // ANT BEAR has no gun of its own, so the only fire is what we hand it.
  const w = new World('antBear');
  w.reset(5);
  for (const id of weapons) w.addWeapon(id);
  return w;
}

function place(w: World, def: EnemyDef, x: number, y: number): Enemy {
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, def);
  e.x = x;
  e.y = y;
  return e;
}

/** Runs frames with the darkness held back, so only the obstacle matters. */
function run(w: World, frames: number, input: InputFrame): void {
  const mk = clockFactory();
  for (let i = 0; i < frames; i++) {
    w.darkness.y = w.player.y - 600;
    w.update(mk(1), input);
  }
}

describe('obstacles', () => {
  it('stop the player instead of killing it', () => {
    const w = world();
    const p = w.player;
    const block = place(w, BLOCK_LARGE, p.x, p.y + 140);

    run(w, 120, drag(0, 4));

    expect(p.alive).toBe(true);
    expect(w.phase).toBe('playing');
    // Held against the face turned toward it, not inside the block.
    const face = block.y - block.boxHalf - p.drawSize * PLAYER_SOLID_RADIUS_FRAC;
    expect(p.y).toBeCloseTo(face, 3);
  });

  it('let the player slide along a face when dragged into it at an angle', () => {
    const w = world();
    const p = w.player;
    place(w, BLOCK_LARGE, p.x, p.y + 140);
    const x0 = p.x;

    run(w, 120, drag(2, 4));

    expect(p.alive).toBe(true);
    expect(p.x - x0).toBeGreaterThan(150);
  });

  it('score nothing when shot down', () => {
    // Directly, not by firing: a live run also kills ordinary enemies, and
    // the pool recycles the block's slot the moment it dies.
    const w = world();
    const block = place(w, BLOCK_LARGE, 300, 400);
    damageEnemy(w, block, 1e6);

    expect(block.alive).toBe(false);
    expect(w.score).toBe(0);
  });

  it('stop ordinary shots, but a BEAM goes straight through', () => {
    // The same layout twice: a block between the player and a target.
    const target = ENEMIES.find((e) => e.id === 'bear.black');
    if (target === undefined) throw new Error('no bear');

    for (const [weapon, through] of [
      ['TWIN_SHOT', false],
      ['BEAM', true],
    ] as const) {
      const w = world(weapon);
      const p = w.player;
      const wall = place(w, { ...BLOCK_LARGE, hp: 1e6 }, p.x, p.y + 160);
      const bear = place(w, { ...target, hp: 1e6, speed: 0 }, p.x, p.y + 320);
      bear.vx = 0;
      bear.vy = 0;

      run(w, 60 * 3, drag(0, 0));

      expect(wall.hp, `${weapon} hits the block`).toBeLessThan(1e6);
      if (through) expect(bear.hp, weapon).toBeLessThan(1e6);
      else expect(bear.hp, weapon).toBe(1e6);
    }
  });

  it('a green one sprays coins when destroyed', () => {
    const w = world();
    const g = place(w, greenVariant(BLOCK_LARGE), 300, 400);
    damageEnemy(w, g, 1e6);

    let coins = 0;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.active[i];
      if (k.kind === 'coin') coins += k.value;
    }
    expect(coins).toBe((greenVariant(BLOCK_LARGE).dropCount ?? 1) * COIN_VALUE);
    expect(coins).toBeGreaterThan(COIN_VALUE);
  });

  it('are never chased by homing shots', () => {
    // A tree off to the side, out of the shots' straight path. Homing that
    // locked onto scenery would bend round and chew it down.
    const w = world('HOMING_SHOT', 'HOMING_SHOT');
    const p = w.player;
    const tree = place(w, { ...TREE, hp: 1e6 }, p.x + 230, p.y);

    run(w, 60 * 4, drag(0, 0));

    expect(tree.hp).toBe(1e6);
  });
});

describe('obstacle clusters', () => {
  it('always leave a way through, with at most one green member', () => {
    const w = world();
    let greens = 0;
    for (let c = 0; c < 300; c++) {
      w.enemies.clear();
      w.spawner['spawnCluster'](w, 1000);

      const members: Enemy[] = [];
      for (let i = 0; i < w.enemies.count; i++) members.push(w.enemies.active[i]);
      expect(members.length).toBeGreaterThan(0);

      const g = members.filter((e) => e.colorRole === 'green').length;
      expect(g).toBeLessThanOrEqual(1);
      greens += g;

      for (const e of members) {
        const half = e.boxHalf > 0 ? e.boxHalf : e.hitboxRadius;
        expect(e.solid).toBe(true);
        expect(e.x - half).toBeGreaterThan(0);
        expect(e.x + half).toBeLessThan(WORLD_W);
      }
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const ha = a.boxHalf > 0 ? a.boxHalf : a.hitboxRadius;
          const hb = b.boxHalf > 0 ? b.boxHalf : b.hitboxRadius;
          const need = ha + hb + OBSTACLE_PASSAGE;
          const apart =
            Math.abs(a.x - b.x) >= need || Math.abs(a.y - b.y) >= need;
          expect(apart).toBe(true);
        }
      }
    }
    // The green one is "sometimes", not never.
    expect(greens).toBeGreaterThan(50);
  });

  it('arrive with distance, out of sight ahead, and outside the enemy cap', () => {
    const w = world();
    const p = w.player;
    const mk = clockFactory();
    const seen = new Set<Enemy>();
    let clusters = 0;

    for (let i = 0; i < 1500; i++) {
      p.invulnRealFor = 1e9;
      w.darkness.y = p.y - 600;
      // Teleport forward rather than drag, along the wall where obstacles
      // always leave room: down the middle, a big block would stop us.
      p.x = 20;
      p.y += 6;
      const before = seen.size;
      w.update(mk(1), drag(0, 0));

      for (let j = 0; j < w.enemies.count; j++) {
        const e = w.enemies.active[j];
        if (!e.solid || seen.has(e)) continue;
        seen.add(e);
        // First seen already beyond the top of the view: nothing pops in.
        const half = e.boxHalf > 0 ? e.boxHalf : e.hitboxRadius;
        expect(e.y - half).toBeGreaterThan(w.camera.y + VIEW_H / 2);
      }
      if (seen.size > before) clusters++;
      // Pool objects are recycled; forget the ones that left.
      for (const e of seen) if (!e.alive) seen.delete(e);
    }
    // 9000 units of road at 1100-2100 apart.
    expect(clusters).toBeGreaterThanOrEqual(4);
  });

  it('do not count toward the enemy cap', () => {
    // More obstacles than the whole cap, parked far ahead. Were they counted,
    // not a single enemy could spawn.
    const w = world();
    const p = w.player;
    for (let i = 0; i < 40; i++) {
      place(w, { ...TREE, hp: 1e6 }, 60 + (i % 10) * 70, p.y + 2000 + i * 40);
    }
    expect(w.enemies.count).toBeGreaterThan(w.spawner.cap(w.score));

    run(w, 60 * 10, drag(0, 0));

    let enemies = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      if (!w.enemies.active[i].solid) enemies++;
    }
    expect(enemies).toBeGreaterThan(0);
  });
});
