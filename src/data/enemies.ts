import type { ShapeId } from './shapes';

/**
 * Enemy roster. Milestone 1 ships 7 of the original's 30; the rest are pure
 * data entry against this same shape.
 *
 * COLOUR IS BEHAVIOUR, which is the original's own convention and worth
 * preserving exactly because it teaches the player to read a crowded screen at
 * a glance:
 *   black  - travels straight along its heading
 *   orange - homes toward the player
 *   purple - zigzags, and is fast
 *   blue   - carries a weapon
 *   green  - carries coins
 */
export type MoveArchetype =
  | 'straight'
  | 'homing'
  | 'zigzag'
  | 'drift'
  | 'turret'
  | 'orbitPlayer';

export type ColorRole =
  | 'black'
  | 'orange'
  | 'purple'
  | 'blue'
  | 'green'
  | 'boss';

export type DropKind = 'none' | 'weapon' | 'coin';

export interface EnemyDef {
  readonly id: string;
  readonly colorRole: ColorRole;
  readonly shape: ShapeId;
  readonly drawSize: number;
  /**
   * Collision reads THIS, never drawSize. Keeping the hitbox well inside the
   * silhouette is what makes dense screens survivable.
   */
  readonly hitboxRadius: number;
  readonly hp: number;
  readonly archetype: MoveArchetype;
  readonly speed: number;
  /** zigzag only: lateral amplitude (world units) and frequency (Hz). */
  readonly zigAmp?: number;
  readonly zigHz?: number;
  readonly scoreValue: number;
  readonly drop: DropKind;
  /** Not spawned below this score. */
  readonly minScore: number;
  readonly spawnWeight: number;
  /**
   * How many arrive together. The original sends enemies in rows and flocks
   * ("birds come in large flocks from the front", "snakes swarm from all
   * sides"), and a one-at-a-time spawner can never feel like that however
   * fast you make it. Defaults to a lone spawn when omitted.
   */
  readonly groupMin?: number;
  readonly groupMax?: number;
}

/**
 * Score values are tuned so the researched thresholds land where they should:
 * a basic kill at 10 puts the first boss (500) around 50 kills, roughly a
 * minute in, and HARD MODE (10000) at the far end of a long run. The sources
 * quote "200 or 300 per enemy", but that would put the 500-point boss three
 * kills into a run, so the thresholds and the per-kill value cannot both be
 * literal. The thresholds are the better-attested half, so they win.
 */
export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'penguin.black',
    colorRole: 'black',
    shape: 'penguin',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'straight',
    speed: 95,
    scoreValue: 10,
    drop: 'none',
    minScore: 0,
    spawnWeight: 30,
    groupMin: 1,
    groupMax: 3,
  },
  {
    id: 'bird.black',
    colorRole: 'black',
    shape: 'bird',
    drawSize: 30,
    hitboxRadius: 9,
    hp: 1,
    archetype: 'straight',
    speed: 150,
    scoreValue: 10,
    drop: 'none',
    minScore: 0,
    spawnWeight: 18,
    groupMin: 3,
    groupMax: 6,
  },
  {
    id: 'penguin.orange',
    colorRole: 'orange',
    shape: 'penguin',
    drawSize: 36,
    hitboxRadius: 13,
    hp: 3,
    archetype: 'homing',
    speed: 88,
    scoreValue: 20,
    drop: 'none',
    minScore: 60,
    spawnWeight: 16,
    groupMin: 1,
    groupMax: 2,
  },
  {
    id: 'dog.orange',
    colorRole: 'orange',
    shape: 'dog',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 2,
    archetype: 'homing',
    speed: 120,
    scoreValue: 20,
    drop: 'none',
    minScore: 120,
    spawnWeight: 14,
    groupMin: 1,
    groupMax: 3,
  },
  {
    id: 'dog.purple',
    colorRole: 'purple',
    shape: 'dog',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'zigzag',
    speed: 185,
    zigAmp: 120,
    zigHz: 0.9,
    scoreValue: 20,
    drop: 'none',
    minScore: 200,
    spawnWeight: 14,
    groupMin: 1,
    groupMax: 2,
  },
  {
    id: 'bear.black',
    colorRole: 'black',
    shape: 'bear',
    drawSize: 46,
    hitboxRadius: 18,
    hp: 5,
    archetype: 'straight',
    speed: 80,
    scoreValue: 40,
    drop: 'none',
    minScore: 300,
    spawnWeight: 10,
  },
  /** Blue "?" crate: the weapon source. */
  {
    id: 'crate.weapon',
    colorRole: 'blue',
    shape: 'block',
    drawSize: 34,
    hitboxRadius: 14,
    hp: 2,
    archetype: 'drift',
    speed: 28,
    scoreValue: 5,
    drop: 'weapon',
    minScore: 0,
    spawnWeight: 20,
  },
  /** Green carrier: the coin source. */
  {
    id: 'carrier.coin',
    colorRole: 'green',
    shape: 'penguin',
    drawSize: 32,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'drift',
    speed: 32,
    scoreValue: 5,
    drop: 'coin',
    minScore: 0,
    spawnWeight: 16,
    groupMin: 1,
    groupMax: 2,
  },
];

export function enemiesAvailableAt(score: number): EnemyDef[] {
  return ENEMIES.filter((e) => score >= e.minScore);
}
