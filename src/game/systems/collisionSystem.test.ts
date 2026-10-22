import { beforeEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../data/enemies';
import type { EnemyDef } from '../../data/enemies';
import type { Enemy } from '../entities/Enemy';
import { applyDef } from '../entities/Enemy';
import { World } from '../World';
import { resolveCollisions } from './collisionSystem';

function defById(id: string): EnemyDef {
  const d = ENEMIES.find((e) => e.id === id);
  if (d === undefined) throw new Error(`no enemy def ${id}`);
  return d;
}

function placeEnemy(w: World, id: string, x: number, y: number): Enemy {
  const e = w.enemies.spawn();
  if (e === null) throw new Error('enemy pool empty');
  applyDef(e, defById(id));
  e.x = x;
  e.y = y;
  return e;
}

function placeEnemyShot(
  w: World,
  x: number,
  y: number,
  owner: Enemy | null,
): void {
  const s = w.enemyShots.spawn();
  if (s === null) throw new Error('shot pool empty');
  s.x = x;
  s.y = y;
  s.radius = 5;
  s.size = 12;
  s.damage = 1;
  s.life = 3;
  s.faction = 1;
  s.maxHits = 1;
  s.hits = 0;
  s.ownerRef = owner;
  s.ownerGen = owner === null ? -1 : owner.gen;
}

/**
 * "Enemy bullets damage other enemies" is a rule of the original, and it is
 * what makes positioning a turret's line of fire across a crowd worth doing.
 * It is also invisible when broken - the game just feels slightly less clever -
 * so it gets a test.
 */
describe('enemy friendly fire', () => {
  let w: World;

  beforeEach(() => {
    w = new World();
    w.reset(1);
    // Keep the player out of every line of fire; these cases are about
    // enemy-on-enemy only.
    w.player.x = 20;
    w.player.y = 5000;
    w.player.invulnRealFor = 1e9;
  });

  it('damages a bystander enemy', () => {
    const victim = placeEnemy(w, 'bear.black', 200, 200);
    const hp0 = victim.hp;
    placeEnemyShot(w, 200, 200, null);

    resolveCollisions(w);

    expect(victim.hp).toBe(hp0 - 1);
  });

  it('kills a bystander and scores it', () => {
    const victim = placeEnemy(w, 'penguin.black', 300, 300); // hp 1
    placeEnemyShot(w, 300, 300, null);

    resolveCollisions(w);

    expect(victim.alive).toBe(false);
    expect(w.score).toBeGreaterThan(0);
  });

  it('never lets a shooter hit itself', () => {
    const shooter = placeEnemy(w, 'turret.horizontal', 400, 400);
    const hp0 = shooter.hp;
    placeEnemyShot(w, 400, 400, shooter);

    resolveCollisions(w);

    expect(shooter.hp).toBe(hp0);
    expect(shooter.alive).toBe(true);
  });

  it("does not extend a dead shooter's exemption to whatever reuses its slot", () => {
    const shooter = placeEnemy(w, 'turret.horizontal', 400, 400);
    placeEnemyShot(w, 400, 400, shooter);

    // The shooter dies and its pool slot is recycled before the bullet lands.
    shooter.alive = false;
    w.enemies.compact();

    const reuser = placeEnemy(w, 'bear.black', 400, 400);
    const hp0 = reuser.hp;
    expect(reuser).toBe(shooter); // same object, new generation

    resolveCollisions(w);

    expect(reuser.hp, 'generation must invalidate the exemption').toBe(hp0 - 1);
  });
});
