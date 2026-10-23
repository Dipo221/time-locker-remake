import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE,
  BASE_BULLET_SPEED,
  BASE_FIRE_CADENCE,
} from '../config';
import type {
  ProjectileSpec,
  ProjectileWeaponId,
  WeaponDef,
} from '../game/weapons/types';

const BASIC: ProjectileSpec = {
  shape: 'bulletLong',
  size: BASE_BULLET_SIZE,
  speed: BASE_BULLET_SPEED,
  damage: BASE_BULLET_DAMAGE,
  lifetime: BASE_BULLET_LIFETIME,
  maxHits: 1,
};

/**
 * The full twelve, less the three that are drones (MINE BOT, GUARD BIT,
 * SUPPORTER) and live in data/drones.ts.
 *
 * Rarity follows the source's own "how often it drops" ratings, which are the
 * balance: BEAM and ICE CANON are rated 2, MINE BOT and LINE 1, and SUPPORTER
 * is so rare one guide author never saw it in a 50,000-point run. Making the
 * strong ones common would flatten the whole progression.
 *
 * Stacking is unbounded, per the original: "weapons can be stacked as many
 * times as you like, with no limit". The ceiling is on GEOMETRY, not power -
 * see weapons/compile.ts.
 */
export const WEAPONS: Record<ProjectileWeaponId, WeaponDef> = {
  /** The common one. A single pickup is weak; it is felt around five. */
  TWIN_SHOT: {
    id: 'TWIN_SHOT',
    name: 'TWIN SHOT',
    tags: ['forward'],
    pickupWeight: 40,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 9 },
    emitters: [
      {
        id: 'twin',
        anglesDeg: [0],
        burst: 2,
        spreadDeg: 10,
        cadence: BASE_FIRE_CADENCE * 1.25,
        phase: 0.33,
        muzzleY: 16,
        projectile: { ...BASIC, speed: BASE_BULLET_SPEED * 0.95 },
      },
    ],
  },

  /** Fires out to both sides of forward; with the base shot it reads as 3-way. */
  WIDE_SHOT: {
    id: 'WIDE_SHOT',
    name: 'WIDE SHOT',
    tags: ['spread'],
    pickupWeight: 38,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 13 },
    emitters: [
      {
        id: 'wide',
        anglesDeg: [-45, 45],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 1.4,
        phase: 0.66,
        muzzleY: 10,
        projectile: { ...BASIC, size: BASE_BULLET_SIZE * 0.9 },
      },
    ],
  },

  /** Straight out to the sides. Three of them makes lateral movement safe. */
  SIDE_SHOT: {
    id: 'SIDE_SHOT',
    name: 'SIDE SHOT',
    tags: ['lateral'],
    pickupWeight: 26,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 8 },
    emitters: [
      {
        id: 'side',
        anglesDeg: [-90, 90],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 1.7,
        phase: 0.15,
        muzzleY: 0,
        projectile: {
          ...BASIC,
          size: BASE_BULLET_SIZE * 0.85,
          speed: BASE_BULLET_SPEED * 0.85,
        },
      },
    ],
  },

  /**
   * Red shots that chase. Weak per hit, but they cover the sides and rear,
   * which is exactly where a forward-firing loadout is blind. The source
   * singles them out for dangerous small enemies like armed infantry.
   */
  HOMING_SHOT: {
    id: 'HOMING_SHOT',
    name: 'HOMING SHOT',
    tags: ['homing'],
    pickupWeight: 18,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 40 },
    emitters: [
      {
        id: 'homing',
        anglesDeg: [-25, 25],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 2.2,
        phase: 0.45,
        muzzleY: 8,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 0.8,
          speed: BASE_BULLET_SPEED * 0.52,
          damage: BASE_BULLET_DAMAGE * 0.9,
          lifetime: 3.2,
          maxHits: 1,
          behaviours: [
            {
              kind: 'homing',
              turnRateDeg: 260,
              acquireRadius: 420,
              retargetSec: 0.5,
            },
          ],
        },
      },
    ],
  },

  /**
   * Slow, heavy, explosive. Rated 5 for power and 1 for range: it is the
   * answer to bosses and large enemies, and close to useless against a swarm.
   */
  ROCKET: {
    id: 'ROCKET',
    name: 'ROCKET',
    tags: ['rocket'],
    pickupWeight: 18,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 16 },
    emitters: [
      {
        id: 'rocket',
        anglesDeg: [0],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 4.2,
        phase: 0.1,
        muzzleY: 18,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 1.5,
          speed: BASE_BULLET_SPEED * 0.42,
          damage: BASE_BULLET_DAMAGE * 4,
          lifetime: 2.6,
          maxHits: 1,
          behaviours: [
            { kind: 'accelerate', accel: 900, maxSpeed: 980 },
            { kind: 'explodeOnHit', radius: 78, damage: BASE_BULLET_DAMAGE * 3 },
          ],
        },
      },
    ],
  },

  /**
   * One of the few piercing weapons: it goes through enemies and walls alike,
   * which makes it the crowd-clearer. Rated 5 against small enemies and 2
   * against bosses - it shreds a line, but a single tough target barely
   * notices.
   */
  BEAM: {
    id: 'BEAM',
    name: 'BEAM',
    tags: ['beam'],
    pickupWeight: 10,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 7 },
    emitters: [
      {
        id: 'beam',
        anglesDeg: [0],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 2.6,
        phase: 0.2,
        muzzleY: 20,
        projectile: {
          shape: 'beam',
          size: BASE_BULLET_SIZE * 2.6,
          speed: BASE_BULLET_SPEED * 1.5,
          damage: BASE_BULLET_DAMAGE * 0.9,
          lifetime: 1.6,
          // Pierces everything in its path, as the source describes.
          maxHits: Number.POSITIVE_INFINITY,
        },
      },
    ],
  },

  /**
   * Zero damage. It freezes what it touches, which is the counter to a boss
   * you cannot out-manoeuvre - the source names it as the answer to the
   * gorilla specifically.
   *
   * It is also a trap, faithfully: a frozen enemy still kills on contact, so
   * freezing a crowd leaves a field of stationary landmines.
   */
  ICE_CANON: {
    id: 'ICE_CANON',
    name: 'ICE CANON',
    tags: ['ice'],
    pickupWeight: 10,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 18 },
    emitters: [
      {
        id: 'ice',
        anglesDeg: [0],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 2.4,
        phase: 0.55,
        muzzleY: 14,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 1.1,
          speed: BASE_BULLET_SPEED * 0.8,
          damage: 0,
          lifetime: 2.0,
          maxHits: 3,
          behaviours: [{ kind: 'freezing', durationSec: 2.4 }],
        },
      },
    ],
  },

  /** A rocket that chases. Rated 5 against bosses, like ROCKET, but it lands. */
  MISSILE: {
    id: 'MISSILE',
    name: 'MISSILE',
    tags: ['rocket', 'homing'],
    pickupWeight: 10,
    stack: { kind: 'addBarrels', perStack: 1, spreadDeg: 22 },
    emitters: [
      {
        id: 'missile',
        anglesDeg: [-12, 12],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 4.8,
        phase: 0.75,
        muzzleY: 12,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 1.25,
          speed: BASE_BULLET_SPEED * 0.3,
          damage: BASE_BULLET_DAMAGE * 3,
          lifetime: 3.6,
          maxHits: 1,
          behaviours: [
            {
              kind: 'homing',
              turnRateDeg: 200,
              acquireRadius: 560,
              retargetSec: 0.7,
            },
            { kind: 'accelerate', accel: 520, maxSpeed: 700 },
            { kind: 'explodeOnHit', radius: 64, damage: BASE_BULLET_DAMAGE * 2 },
          ],
        },
      },
    ],
  },

  /**
   * The rarest and the best. The source rates it 5 for power, for small
   * enemies and for bosses alike, and calls it near-universal: it roughly
   * doubles the forward stream and fires continuously rather than on an
   * interval.
   */
  LINE: {
    id: 'LINE',
    name: 'LINE',
    tags: ['forward'],
    pickupWeight: 4,
    stack: { kind: 'addBarrels', perStack: 2, spreadDeg: 6 },
    emitters: [
      {
        id: 'line',
        anglesDeg: [0],
        burst: 3,
        spreadDeg: 7,
        // Near-continuous, which is what separates it from TWIN SHOT.
        cadence: BASE_FIRE_CADENCE * 0.42,
        phase: 0.05,
        muzzleY: 16,
        projectile: {
          ...BASIC,
          size: BASE_BULLET_SIZE * 0.95,
          speed: BASE_BULLET_SPEED * 1.1,
        },
      },
    ],
  },
};

export const PROJECTILE_WEAPON_IDS = Object.keys(
  WEAPONS,
) as ProjectileWeaponId[];

/** Lookup that tolerates a drone id, for code that walks the whole loadout. */
export function getProjectileWeapon(id: string): WeaponDef | undefined {
  return (WEAPONS as Record<string, WeaponDef | undefined>)[id];
}
