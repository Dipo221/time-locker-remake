import type { EmitterSpec } from '../game/weapons/types';
import type { ShapeId } from './shapes';

/**
 * Enemy fire is deliberately slow and sparse compared to the player's. The
 * player can freeze time to read a bullet pattern, so enemy shots are threats
 * to route around rather than a bullet-hell curtain to thread.
 */
const ENEMY_SHOT = {
  shape: 'bulletRound',
  size: 13,
  speed: 210,
  damage: 1,
  lifetime: 3.4,
  maxHits: 1,
} as const;

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
  /**
   * Enemies fire through the SAME EmitterSpec the player's weapons use, into
   * the same projectile pool, through the same behaviour code. The only
   * differences are the faction flag and the colour role. That shared type is
   * why "enemy bullets damage other enemies" costs one row in the collision
   * matrix rather than a feature.
   */
  readonly weapon?: EmitterSpec;
  /**
   * 'facing' fires along the direction of travel (a tank's main gun).
   * 'player' leads at the player wherever it is (infantry, turrets).
   */
  readonly aim?: 'facing' | 'player';
  /**
   * Air units. The original only lets some homing weapons touch them; until
   * MISSILE and MINE BOT exist, nothing in the roster sets this, because an
   * unkillable enemy is worse than a missing one.
   */
  readonly flying?: boolean;
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
  // ---------------------------------------------------------------------
  // Shooters. Up to here every enemy killed by contact only, which made the
  // whole game one-dimensional: positional dodging and nothing else.
  // ---------------------------------------------------------------------

  /**
   * Vertical turret: stationary, long interval, fires along its own axis.
   * Rated 4 for durability but 1 for danger in the source - a landmark to
   * route around rather than a threat that chases you.
   */
  {
    id: 'turret.vertical',
    colorRole: 'black',
    shape: 'block',
    drawSize: 38,
    hitboxRadius: 15,
    hp: 4,
    archetype: 'turret',
    speed: 0,
    scoreValue: 30,
    drop: 'none',
    minScore: 140,
    spawnWeight: 12,
    aim: 'facing',
    weapon: {
      id: 'turretV',
      anglesDeg: [0, 180],
      burst: 1,
      spreadDeg: 0,
      cadence: 1.5,
      phase: 0,
      muzzleY: 20,
      projectile: ENEMY_SHOT,
    },
  },

  /**
   * Horizontal turret: the source rates this danger 5 and says its fire is
   * dense enough that you cannot squeeze through. It is a wall you must
   * destroy or go around, and the first enemy that really rewards stopping
   * time to read the gap.
   */
  {
    id: 'turret.horizontal',
    colorRole: 'purple',
    shape: 'block',
    drawSize: 38,
    hitboxRadius: 15,
    hp: 2,
    archetype: 'turret',
    speed: 0,
    scoreValue: 35,
    drop: 'none',
    minScore: 260,
    spawnWeight: 10,
    aim: 'facing',
    weapon: {
      id: 'turretH',
      anglesDeg: [90, 270],
      burst: 1,
      spreadDeg: 0,
      cadence: 0.42,
      phase: 0,
      muzzleY: 18,
      projectile: ENEMY_SHOT,
    },
  },

  /** Tank: moves while firing, mostly forward. */
  {
    id: 'tank.black',
    colorRole: 'black',
    shape: 'block',
    drawSize: 40,
    hitboxRadius: 16,
    hp: 4,
    archetype: 'straight',
    speed: 85,
    scoreValue: 35,
    drop: 'none',
    minScore: 200,
    spawnWeight: 11,
    aim: 'facing',
    weapon: {
      id: 'tankGun',
      anglesDeg: [0],
      burst: 1,
      spreadDeg: 0,
      cadence: 1.15,
      phase: 0.2,
      muzzleY: 22,
      projectile: ENEMY_SHOT,
    },
  },

  /** Homing tank: less persistent than other homers, but it aims at you. */
  {
    id: 'tank.orange',
    colorRole: 'orange',
    shape: 'block',
    drawSize: 40,
    hitboxRadius: 16,
    hp: 4,
    archetype: 'homing',
    speed: 70,
    scoreValue: 45,
    drop: 'none',
    minScore: 420,
    spawnWeight: 9,
    aim: 'player',
    weapon: {
      id: 'tankGunAimed',
      anglesDeg: [0],
      burst: 1,
      spreadDeg: 0,
      cadence: 1.4,
      phase: 0.5,
      muzzleY: 22,
      projectile: ENEMY_SHOT,
    },
  },

  /**
   * Infantry: individually trivial (speed 1, durability 1) but the source
   * rates them danger 5, because they swarm from every side and shoot while
   * walking. Weak, numerous and armed is the dangerous combination.
   */
  {
    id: 'infantry',
    colorRole: 'orange',
    shape: 'locker',
    drawSize: 26,
    hitboxRadius: 10,
    hp: 1,
    archetype: 'homing',
    speed: 52,
    scoreValue: 15,
    drop: 'none',
    minScore: 320,
    spawnWeight: 14,
    groupMin: 2,
    groupMax: 4,
    aim: 'player',
    weapon: {
      id: 'rifle',
      anglesDeg: [0],
      burst: 1,
      spreadDeg: 0,
      cadence: 2.1,
      phase: 0.4,
      muzzleY: 14,
      projectile: { ...ENEMY_SHOT, size: 11, speed: 250 },
    },
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
