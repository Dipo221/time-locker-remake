import { OBSTACLE_HP_PER_AREA } from '../config';
import type { EnemyDef } from './enemies';

/**
 * Terrain: blocks and trees that stand in the corridor. They ride the enemy
 * pool because everything that should touch them already lives there -
 * shots, explosions, the BEAM that pierces them, coin drops - and the
 * `solid` flag carves out the differences (see EnemyDef.solid).
 *
 * Kept out of ENEMIES so the ordinary spawn roll never picks one; the
 * SpawnDirector lays them out in clusters by distance instead.
 */
function obstacle(
  id: string,
  shape: 'slab' | 'tree',
  drawSize: number,
): EnemyDef {
  // Health goes with footprint. A tree is mostly canopy you can see past,
  // so it counts for a little less than a block of the same size.
  const area = (drawSize / 100) ** 2 * (shape === 'tree' ? 0.8 : 1);
  const hp = Math.round(OBSTACLE_HP_PER_AREA * area);
  return {
    id,
    colorRole: 'grey',
    shape,
    drawSize,
    // A box's body is its drawn square, so it needs no extra radius. A tree
    // is round, and only its middle is solid.
    hitboxRadius: shape === 'slab' ? 0 : Math.round(drawSize * 0.3),
    hp,
    archetype: 'turret',
    speed: 0,
    scoreValue: 0,
    drop: 'none',
    minScore: 0,
    spawnWeight: 0,
    solid: shape === 'slab' ? 'box' : 'round',
  };
}

/** The green member of a cluster: the same obstacle, sprayed with coins. */
function green(def: EnemyDef): EnemyDef {
  return {
    ...def,
    id: `${def.id}.green`,
    colorRole: 'green',
    drop: 'coin',
    dropCount: 4,
  };
}

/*
 * Big enough to actually stand in the way: the first sizes (76-112) were
 * stepped round without noticing. A large block is now over a fifth of the
 * corridor.
 */
export const BLOCK_LARGE = obstacle('obstacle.block.large', 'slab', 170);
export const BLOCK_MEDIUM = obstacle('obstacle.block.medium', 'slab', 125);
export const BLOCK_SMALL = obstacle('obstacle.block.small', 'slab', 85);
export const TREE = obstacle('obstacle.tree', 'tree', 84);

/** What a cluster is built from; each kind's members come from one list. */
export const OBSTACLE_KINDS: readonly (readonly EnemyDef[])[] = [
  [BLOCK_LARGE, BLOCK_MEDIUM, BLOCK_SMALL],
  [TREE],
];

const GREEN = new Map<EnemyDef, EnemyDef>(
  [BLOCK_LARGE, BLOCK_MEDIUM, BLOCK_SMALL, TREE].map((d) => [d, green(d)]),
);

export function greenVariant(def: EnemyDef): EnemyDef {
  return GREEN.get(def) ?? def;
}
