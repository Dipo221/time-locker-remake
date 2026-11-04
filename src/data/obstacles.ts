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
  hp: number,
): EnemyDef {
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

export const BLOCK_LARGE = obstacle('obstacle.block.large', 'slab', 112, 18);
export const BLOCK_SMALL = obstacle('obstacle.block.small', 'slab', 76, 9);
export const TREE = obstacle('obstacle.tree', 'tree', 66, 6);

/** What a cluster is built from; each kind's members come from one list. */
export const OBSTACLE_KINDS: readonly (readonly EnemyDef[])[] = [
  [BLOCK_LARGE, BLOCK_SMALL],
  [TREE],
];

const GREEN = new Map<EnemyDef, EnemyDef>(
  [BLOCK_LARGE, BLOCK_SMALL, TREE].map((d) => [d, green(d)]),
);

export function greenVariant(def: EnemyDef): EnemyDef {
  return GREEN.get(def) ?? def;
}
