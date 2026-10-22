import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE,
  BASE_BULLET_SPEED,
  BASE_FIRE_CADENCE,
} from '../config';
import type {
  ProjectileSpec,
  WeaponDef,
  WeaponId,
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
 * Milestone 1 ships 3 of the original's 12. The remaining nine (HOMING SHOT,
 * ROCKET, BEAM, MINE BOT, ICE CANON, MISSILE, LINE, GUARD BIT, SUPPORTER) need
 * projectile behaviours before they can be expressed, but they are the same
 * shape of data.
 *
 * Stacking is unbounded, per the original: "weapons can be stacked as many
 * times as you like, with no limit". The ceiling is on GEOMETRY, not power -
 * see compile.ts.
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
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
    pickupWeight: 34,
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
        projectile: {
          ...BASIC,
          size: BASE_BULLET_SIZE * 0.9,
          damage: BASE_BULLET_DAMAGE,
        },
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
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
