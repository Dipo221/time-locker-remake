import type { EmitterSpec } from '../game/weapons/types';
import type { ShapeId } from './shapes';

/**
 * Enemy fire is deliberately slow and sparse compared to the player's. The
 * player can freeze time to read a bullet pattern, so enemy shots are threats
 * to route around rather than a bullet-hell curtain to thread.
 */
/**
 * A helicopter's bomb. Big, slow and heavy-hitting - the source calls them
 * very strong, and since they are ordinary enemy fire they damage any ground
 * enemy they land on, bosses included.
 */
const BOMB = {
  shape: 'bulletRound',
  size: 20,
  speed: 150,
  damage: 6,
  lifetime: 2.4,
  maxHits: 1,
} as const;

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
  | 'orbitPlayer'
  | 'charger'
  | 'hopper';

export type ColorRole =
  | 'black'
  | 'orange'
  | 'purple'
  | 'blue'
  | 'green'
  | 'boss'
  | 'grey';

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

  // --- boss-only ---------------------------------------------------------
  /** Bosses persist until killed: no offscreen cull, no death by darkness. */
  readonly isBoss?: boolean;
  /** Shown on the boss health bar. */
  readonly displayName?: string;
  /** orbitPlayer: the standoff distance it tries to hold while circling. */
  readonly orbitRadius?: number;
  /** charger: seconds of telegraphed pause before each dash. */
  readonly chargeWindup?: number;
  /** charger: dash speed, and how long a dash lasts. */
  readonly chargeSpeed?: number;
  readonly chargeDuration?: number;

  // --- hopper (frogs) ----------------------------------------------------
  /** Seconds sat still between hops. */
  readonly hopPause?: number;
  /** Seconds a hop lasts, and how fast it travels. */
  readonly hopDuration?: number;
  readonly hopSpeed?: number;
  /**
   * Where each hop points. 'straight' keeps its spawn heading, 'homing'
   * re-aims at the player every hop, 'random' picks any direction - the
   * source's black, orange and purple frogs respectively.
   */
  readonly hopMode?: 'straight' | 'homing' | 'random';

  /**
   * Body length trailing behind the head, for snakes and trailers. Collision
   * treats the whole body as a capsule, because the length IS the threat -
   * the source calls the snake "slow but long" and the trailer "the fastest
   * and the longest", and a single circle at the head would make both
   * trivially easy to slip past.
   */
  readonly length?: number;

  // --- obstacles (data/obstacles.ts) ---------------------------------------
  /**
   * Terrain rather than an enemy: it blocks the player instead of killing,
   * stops shots, is never targeted, never counts toward the enemy cap and
   * scores nothing. 'box' is a square exactly drawSize across; 'round' uses
   * hitboxRadius like everything else.
   */
  readonly solid?: 'box' | 'round';
  /** How many coins it drops when destroyed. Defaults to one. */
  readonly dropCount?: number;
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

  // ---------------------------------------------------------------------
  // The rest of the researched roster. Rated speed / durability / danger in
  // the source on a 1-5 scale, mapped here as roughly:
  //   speed      1 -> 90    2 -> 115   3 -> 160   4 -> 210   5 -> 270
  //   durability 1 -> 1 hp  2 -> 2     3 -> 3     4 -> 5     5 -> 8
  // and introduced progressively by score, so a run keeps meeting new things.
  // ---------------------------------------------------------------------

  /** Black dog: the simplest thing in the game. Source: 1/1/1. */
  {
    id: 'dog.black',
    colorRole: 'black',
    shape: 'dog',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'straight',
    speed: 92,
    scoreValue: 10,
    drop: 'none',
    minScore: 0,
    spawnWeight: 22,
    groupMin: 2,
    groupMax: 4,
  },

  /** Purple penguin: weaves, so shots slide off it. Source: 3/1/3. */
  {
    id: 'penguin.purple',
    colorRole: 'purple',
    shape: 'penguin',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'zigzag',
    speed: 160,
    zigAmp: 110,
    zigHz: 1.1,
    scoreValue: 20,
    drop: 'none',
    minScore: 160,
    spawnWeight: 13,
    groupMin: 1,
    groupMax: 3,
  },

  /** Orange birds come in flocks, head-on. Source: 1/1/2. */
  {
    id: 'bird.orange',
    colorRole: 'orange',
    shape: 'bird',
    drawSize: 30,
    hitboxRadius: 9,
    hp: 1,
    archetype: 'homing',
    speed: 105,
    scoreValue: 15,
    drop: 'none',
    minScore: 220,
    spawnWeight: 12,
    groupMin: 4,
    groupMax: 7,
  },

  /** Black lion: mixed in with dog packs, tougher than it looks. Source: 2/3/2. */
  {
    id: 'lion.black',
    colorRole: 'black',
    shape: 'lion',
    drawSize: 40,
    hitboxRadius: 14,
    hp: 3,
    archetype: 'straight',
    speed: 118,
    scoreValue: 15,
    drop: 'none',
    minScore: 280,
    spawnWeight: 12,
    groupMin: 1,
    groupMax: 2,
  },

  /** Orange lion: hunts you, and favours the flanks. Source: 2/3/3. */
  {
    id: 'lion.orange',
    colorRole: 'orange',
    shape: 'lion',
    drawSize: 40,
    hitboxRadius: 14,
    hp: 3,
    archetype: 'homing',
    speed: 115,
    scoreValue: 20,
    drop: 'none',
    minScore: 420,
    spawnWeight: 10,
  },

  /**
   * Black frog: sits, then springs straight ahead. Source: 2/1/2. The pause
   * is the tell - a frog about to jump looks exactly like one that is not.
   */
  {
    id: 'frog.black',
    colorRole: 'black',
    shape: 'frog',
    drawSize: 34,
    hitboxRadius: 12,
    hp: 1,
    archetype: 'hopper',
    speed: 0,
    hopMode: 'straight',
    hopPause: 0.9,
    hopDuration: 0.32,
    hopSpeed: 330,
    scoreValue: 15,
    drop: 'none',
    minScore: 340,
    spawnWeight: 12,
    groupMin: 1,
    groupMax: 3,
  },

  /** Orange frog: re-aims at you before every hop. Source: 2/3/3. */
  {
    id: 'frog.orange',
    colorRole: 'orange',
    shape: 'frog',
    drawSize: 36,
    hitboxRadius: 13,
    hp: 3,
    archetype: 'hopper',
    speed: 0,
    hopMode: 'homing',
    hopPause: 0.8,
    hopDuration: 0.3,
    hopSpeed: 360,
    scoreValue: 20,
    drop: 'none',
    minScore: 600,
    spawnWeight: 10,
  },

  /** Purple frog: hops constantly, anywhere. Source: 3/1/3. */
  {
    id: 'frog.purple',
    colorRole: 'purple',
    shape: 'frog',
    drawSize: 32,
    hitboxRadius: 11,
    hp: 1,
    archetype: 'hopper',
    speed: 0,
    hopMode: 'random',
    hopPause: 0.3,
    hopDuration: 0.24,
    hopSpeed: 300,
    scoreValue: 20,
    drop: 'none',
    minScore: 760,
    spawnWeight: 9,
    groupMin: 2,
    groupMax: 3,
  },

  /**
   * Black snake: "slow but long", swarming from every side. Source: 2/2/2.
   * The body is a capsule, so the length is genuinely lethal end to end.
   */
  {
    id: 'snake.black',
    colorRole: 'black',
    shape: 'dog',
    drawSize: 26,
    hitboxRadius: 11,
    hp: 2,
    archetype: 'homing',
    speed: 92,
    length: 96,
    scoreValue: 15,
    drop: 'none',
    minScore: 500,
    spawnWeight: 10,
    groupMin: 1,
    groupMax: 3,
  },

  /** Purple snake: faster than you are. Source: 4/2/4. */
  {
    id: 'snake.purple',
    colorRole: 'purple',
    shape: 'dog',
    drawSize: 24,
    hitboxRadius: 10,
    hp: 2,
    archetype: 'zigzag',
    speed: 210,
    zigAmp: 70,
    zigHz: 0.7,
    length: 74,
    scoreValue: 30,
    drop: 'none',
    minScore: 1100,
    spawnWeight: 8,
  },

  /** Black dinosaur: no tricks, sometimes from behind. Source: 2/2/2. */
  {
    id: 'dino.black',
    colorRole: 'black',
    shape: 'dino',
    drawSize: 46,
    hitboxRadius: 15,
    hp: 2,
    archetype: 'straight',
    speed: 115,
    scoreValue: 15,
    drop: 'none',
    minScore: 380,
    spawnWeight: 11,
  },

  /** Orange dinosaur: homing and hard to shake. Source: 2/2/3. */
  {
    id: 'dino.orange',
    colorRole: 'orange',
    shape: 'dino',
    drawSize: 46,
    hitboxRadius: 15,
    hp: 2,
    archetype: 'homing',
    speed: 118,
    scoreValue: 20,
    drop: 'none',
    minScore: 680,
    spawnWeight: 9,
  },

  /** Small mammoth: barely moves; a landmark more than a threat. Source: -/3/1. */
  {
    id: 'mammoth.small',
    colorRole: 'black',
    shape: 'mammoth',
    drawSize: 52,
    hitboxRadius: 19,
    hp: 3,
    archetype: 'turret',
    speed: 0,
    scoreValue: 15,
    drop: 'none',
    minScore: 260,
    spawnWeight: 8,
  },

  /** Large mammoth: a wall you have to shoot through or go round. Source: -/5/1. */
  {
    id: 'mammoth.large',
    colorRole: 'black',
    shape: 'mammoth',
    drawSize: 76,
    hitboxRadius: 28,
    hp: 8,
    archetype: 'turret',
    speed: 0,
    scoreValue: 40,
    drop: 'none',
    minScore: 900,
    spawnWeight: 5,
  },

  /** Purple bear: fast, weaving and tough - lethal in a frontal pack. Source: 3/3/5. */
  {
    id: 'bear.purple',
    colorRole: 'purple',
    shape: 'bear',
    drawSize: 46,
    hitboxRadius: 17,
    hp: 3,
    archetype: 'zigzag',
    speed: 160,
    zigAmp: 90,
    zigHz: 0.8,
    scoreValue: 40,
    drop: 'none',
    minScore: 1400,
    spawnWeight: 8,
    groupMin: 2,
    groupMax: 3,
  },

  /** Black car: straight and steady. Source: 2/2/2. */
  {
    id: 'car.black',
    colorRole: 'black',
    shape: 'car',
    drawSize: 42,
    hitboxRadius: 15,
    hp: 2,
    archetype: 'straight',
    speed: 120,
    scoreValue: 15,
    drop: 'none',
    minScore: 450,
    spawnWeight: 10,
  },

  /** Purple car: swerves. Source: 2/2/3. */
  {
    id: 'car.purple',
    colorRole: 'purple',
    shape: 'car',
    drawSize: 42,
    hitboxRadius: 15,
    hp: 2,
    archetype: 'zigzag',
    speed: 120,
    zigAmp: 95,
    zigHz: 0.75,
    scoreValue: 20,
    drop: 'none',
    minScore: 820,
    spawnWeight: 8,
  },

  /**
   * Trailer: "the fastest AND the longest" of every enemy. Source: 5/4/5.
   * A long, fast capsule that sweeps a whole lane - you get out of its way.
   */
  {
    id: 'trailer',
    colorRole: 'black',
    shape: 'car',
    drawSize: 44,
    hitboxRadius: 16,
    hp: 5,
    archetype: 'straight',
    speed: 270,
    length: 150,
    scoreValue: 40,
    drop: 'none',
    minScore: 1600,
    spawnWeight: 6,
  },

  /**
   * Black helicopter: flies one way, dropping bombs ahead of it. Source: 2/2/2.
   *
   * AIRBORNE. Only homing weapons reach it, and touching it is harmless: the
   * source says its hitbox is only the bomb zone and that directly beneath it
   * is safe. Its bombs are ground fire, so they hit anything underneath -
   * including bosses, which the source suggests luring under them on purpose.
   */
  {
    id: 'heli.black',
    colorRole: 'black',
    shape: 'heli',
    drawSize: 50,
    hitboxRadius: 16,
    hp: 2,
    archetype: 'straight',
    speed: 115,
    flying: true,
    scoreValue: 30,
    drop: 'none',
    minScore: 700,
    spawnWeight: 7,
    aim: 'facing',
    weapon: {
      id: 'bombDrop',
      anglesDeg: [0],
      burst: 1,
      spreadDeg: 0,
      cadence: 1.6,
      phase: 0.3,
      muzzleY: 34,
      projectile: BOMB,
    },
  },

  /**
   * Orange helicopter: follows you, and bombs where you are going. Source:
   * 2/2/5 - the most dangerous rating of any regular enemy, because your guns
   * mostly cannot touch it.
   */
  {
    id: 'heli.orange',
    colorRole: 'orange',
    shape: 'heli',
    drawSize: 50,
    hitboxRadius: 16,
    hp: 2,
    archetype: 'homing',
    speed: 112,
    flying: true,
    scoreValue: 45,
    drop: 'none',
    minScore: 1300,
    spawnWeight: 6,
    aim: 'player',
    weapon: {
      id: 'bombAimed',
      anglesDeg: [0],
      burst: 1,
      spreadDeg: 0,
      cadence: 1.9,
      phase: 0.6,
      muzzleY: 30,
      projectile: BOMB,
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
