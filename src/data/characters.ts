import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE,
  BASE_BULLET_SPEED,
  BASE_FIRE_CADENCE,
} from '../config';
import type { CharacterDef, EmitterSpec } from '../game/weapons/types';

const BASIC_PROJECTILE = {
  shape: 'bulletLong',
  size: BASE_BULLET_SIZE,
  speed: BASE_BULLET_SPEED,
  damage: BASE_BULLET_DAMAGE,
  lifetime: BASE_BULLET_LIFETIME,
  maxHits: 1,
} as const;

const BASE_SHOT: EmitterSpec = {
  id: 'base',
  anglesDeg: [0],
  burst: 1,
  spreadDeg: 0,
  cadence: BASE_FIRE_CADENCE,
  phase: 0,
  muzzleY: 16,
  projectile: BASIC_PROJECTILE,
};

/**
 * The roster. Thirteen of the original's eighty-one, chosen so that every
 * axis the data model has to express is actually exercised - which is the
 * point of stopping here rather than at three:
 *
 *   an identity that is purely a hitbox      ANT BEAR
 *   an innate gun                            WIDE RHINO, RIFLE LOCKER
 *   a REAR-facing gun                        BACK SHOOTER, FARTER
 *   a modifier on picked-up weapons          ROCKET LOCKER, BEAM WALKER
 *   free stacks at run start                 MINE LOCKER
 *   a deliberate blind spot                  BACK SHOOTER
 *   trading hitbox size for firepower        FLAP SNIPER, BACK SHOOTER
 *
 * Adding the other sixty-eight is data entry against this same shape; none of
 * it needs code. PODs are the vending machines they are dispensed from.
 */
export const CHARACTERS: Record<string, CharacterDef> = {
  // ---------------------------------------------------------------- free
  theLocker: {
    id: 'theLocker',
    name: 'THE LOCKER',
    blurb: 'Weak gun. Smallest hitbox but one.',
    shape: 'locker',
    drawSize: 40,
    hitboxRadius: 9,
    dragGain: 1,
    innate: [BASE_SHOT],
    modifiers: [],
  },

  // --------------------------------------------------------------- POD 1
  rifleLocker: {
    id: 'rifleLocker',
    name: 'RIFLE LOCKER',
    blurb: 'Rapid fire, offset to the left.',
    shape: 'locker',
    drawSize: 40,
    hitboxRadius: 10,
    dragGain: 1,
    pod: 1,
    innate: [
      {
        ...BASE_SHOT,
        id: 'rifle',
        // The source notes its right side is open: the stream sits off-centre.
        anglesDeg: [-6],
        cadence: BASE_FIRE_CADENCE * 0.45,
        muzzleY: 18,
      },
    ],
    modifiers: [],
  },

  wideRhino: {
    id: 'wideRhino',
    name: 'WIDE RHINO',
    blurb: 'Born with WIDE SHOT, and makes every one it finds bigger.',
    shape: 'bear',
    drawSize: 48,
    hitboxRadius: 14,
    dragGain: 1,
    pod: 1,
    innate: [
      BASE_SHOT,
      {
        id: 'rhinoWide',
        anglesDeg: [-45, 45],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 1.3,
        phase: 0.5,
        muzzleY: 10,
        projectile: {
          ...BASIC_PROJECTILE,
          size: BASE_BULLET_SIZE * 1.6,
          damage: BASE_BULLET_DAMAGE * 1.3,
        },
      },
    ],
    modifiers: [
      {
        when: { weaponId: 'WIDE_SHOT' },
        apply: { mulSize: 1.8, mulDamage: 1.3 },
      },
    ],
  },

  antBear: {
    id: 'antBear',
    name: 'ANT BEAR',
    blurb: 'No weapon at all. The smallest hitbox in the game.',
    shape: 'dog',
    drawSize: 30,
    hitboxRadius: 4,
    dragGain: 1,
    pod: 1,
    innate: [],
    modifiers: [],
  },

  // --------------------------------------------------------------- POD 2
  rocketLocker: {
    id: 'rocketLocker',
    name: 'ROCKET LOCKER',
    blurb: 'Twin rockets - and every ROCKET it picks up becomes twin too.',
    shape: 'locker',
    drawSize: 42,
    hitboxRadius: 12,
    dragGain: 1,
    pod: 2,
    innate: [
      {
        id: 'twinRocket',
        anglesDeg: [-7, 7],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 4,
        phase: 0.2,
        muzzleY: 18,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 1.4,
          speed: BASE_BULLET_SPEED * 0.45,
          damage: BASE_BULLET_DAMAGE * 3,
          lifetime: 2.6,
          maxHits: 1,
          behaviours: [
            { kind: 'accelerate', accel: 900, maxSpeed: 950 },
            {
              kind: 'explodeOnHit',
              radius: 70,
              damage: BASE_BULLET_DAMAGE * 2.5,
            },
          ],
        },
      },
    ],
    modifiers: [
      { when: { tag: 'rocket' }, apply: { addBarrels: 1, addSpreadDeg: 10 } },
    ],
  },

  homingHopper: {
    id: 'homingHopper',
    name: 'HOMING HOPPER',
    blurb: 'Four trackers, weak each. Covers the angles a forward gun cannot.',
    shape: 'dog',
    drawSize: 38,
    hitboxRadius: 12,
    dragGain: 1,
    pod: 2,
    innate: [
      {
        id: 'hopper',
        anglesDeg: [-40, -15, 15, 40],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 2.4,
        phase: 0.3,
        muzzleY: 8,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 0.75,
          speed: BASE_BULLET_SPEED * 0.5,
          damage: BASE_BULLET_DAMAGE * 0.7,
          lifetime: 3,
          maxHits: 1,
          behaviours: [
            {
              kind: 'homing',
              turnRateDeg: 280,
              acquireRadius: 420,
              retargetSec: 0.5,
            },
          ],
        },
      },
    ],
    modifiers: [
      { when: { tag: 'homing' }, apply: { mulSize: 1.4, mulDamage: 1.5 } },
    ],
  },

  bigLineLocker: {
    id: 'bigLineLocker',
    name: 'BIG LINE LOCKER',
    blurb: 'Fat, hard-hitting basic shot. Finds LINE and it is terrifying.',
    shape: 'locker',
    drawSize: 42,
    hitboxRadius: 11,
    dragGain: 1,
    pod: 2,
    innate: [
      {
        ...BASE_SHOT,
        id: 'bigLine',
        cadence: BASE_FIRE_CADENCE * 1.15,
        projectile: {
          ...BASIC_PROJECTILE,
          size: BASE_BULLET_SIZE * 1.8,
          damage: BASE_BULLET_DAMAGE * 2.2,
        },
      },
    ],
    modifiers: [
      { when: { weaponId: 'LINE' }, apply: { mulSize: 1.7, mulDamage: 1.6 } },
    ],
  },

  // --------------------------------------------------------------- POD 3
  backShooter: {
    id: 'backShooter',
    name: 'BACK SHOOTER',
    blurb: 'Ten shots straight backwards. Nothing forward at all.',
    shape: 'dog',
    drawSize: 48,
    hitboxRadius: 16,
    dragGain: 1,
    pod: 3,
    innate: [
      {
        id: 'backSpray',
        // A blind spot is an ABSENCE in the data, not a special case in code.
        anglesDeg: [180],
        burst: 5,
        spreadDeg: 34,
        cadence: BASE_FIRE_CADENCE * 0.8,
        phase: 0,
        muzzleY: 16,
        projectile: { ...BASIC_PROJECTILE, size: BASE_BULLET_SIZE * 0.9 },
      },
    ],
    modifiers: [],
  },

  flapSniper: {
    id: 'flapSniper',
    name: 'FLAP SNIPER',
    blurb: 'Enormous single shot. Hits like a truck, covers nothing.',
    shape: 'bird',
    drawSize: 40,
    hitboxRadius: 11,
    dragGain: 1,
    pod: 3,
    innate: [
      {
        id: 'snipe',
        anglesDeg: [0],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 3.4,
        phase: 0,
        muzzleY: 20,
        projectile: {
          ...BASIC_PROJECTILE,
          size: BASE_BULLET_SIZE * 2.2,
          speed: BASE_BULLET_SPEED * 1.35,
          damage: BASE_BULLET_DAMAGE * 7,
          maxHits: 2,
        },
      },
    ],
    modifiers: [],
  },

  beamWalker: {
    id: 'beamWalker',
    name: 'BEAM WALKER',
    blurb: 'Twin beams. A second BEAM makes it four.',
    shape: 'locker',
    drawSize: 46,
    hitboxRadius: 14,
    dragGain: 1,
    pod: 3,
    innate: [
      {
        id: 'twinBeam',
        anglesDeg: [-5, 5],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 2.4,
        phase: 0.15,
        muzzleY: 20,
        projectile: {
          shape: 'beam',
          size: BASE_BULLET_SIZE * 2.3,
          speed: BASE_BULLET_SPEED * 1.5,
          damage: BASE_BULLET_DAMAGE * 0.85,
          lifetime: 1.5,
          maxHits: Number.POSITIVE_INFINITY,
        },
      },
    ],
    modifiers: [
      {
        when: { weaponId: 'BEAM', minStacks: 2 },
        apply: { addBarrels: 2, addSpreadDeg: 8 },
      },
    ],
  },

  // --------------------------------------------------------------- POD 4
  diffuser: {
    id: 'diffuser',
    name: 'DIFFUSER',
    blurb: 'A shotgun of a character. Close range, everything in front dies.',
    shape: 'bear',
    drawSize: 46,
    hitboxRadius: 14,
    dragGain: 1,
    pod: 4,
    innate: [
      {
        id: 'diffuse',
        anglesDeg: [-55, -30, 0, 30, 55],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 1.5,
        phase: 0.4,
        muzzleY: 12,
        projectile: {
          ...BASIC_PROJECTILE,
          size: BASE_BULLET_SIZE * 0.95,
          speed: BASE_BULLET_SPEED * 0.9,
        },
      },
    ],
    modifiers: [
      { when: { tag: 'spread' }, apply: { addDirectionsDeg: [-70, 70] } },
    ],
  },

  farter: {
    id: 'farter',
    name: 'FARTER',
    blurb: 'Twin rockets out the back. Run away and watch things explode.',
    shape: 'dog',
    drawSize: 40,
    hitboxRadius: 12,
    dragGain: 1,
    pod: 4,
    innate: [
      {
        id: 'backRocket',
        anglesDeg: [172, 188],
        burst: 1,
        spreadDeg: 0,
        cadence: BASE_FIRE_CADENCE * 3.6,
        phase: 0.25,
        muzzleY: 16,
        projectile: {
          shape: 'bulletRound',
          size: BASE_BULLET_SIZE * 1.35,
          speed: BASE_BULLET_SPEED * 0.4,
          damage: BASE_BULLET_DAMAGE * 3,
          lifetime: 2.8,
          maxHits: 1,
          behaviours: [
            { kind: 'accelerate', accel: 700, maxSpeed: 820 },
            {
              kind: 'explodeOnHit',
              radius: 76,
              damage: BASE_BULLET_DAMAGE * 2.5,
            },
          ],
        },
      },
      BASE_SHOT,
    ],
    modifiers: [],
  },

  mineLocker: {
    id: 'mineLocker',
    name: 'MINE LOCKER',
    blurb: 'Starts every run with two mines already orbiting.',
    shape: 'locker',
    drawSize: 42,
    hitboxRadius: 12,
    dragGain: 1,
    pod: 4,
    innate: [BASE_SHOT],
    modifiers: [],
    startWeapons: ['MINE_BOT', 'MINE_BOT'],
  },
};

export const DEFAULT_CHARACTER = 'theLocker';

export const CHARACTER_IDS = Object.keys(CHARACTERS);

/** Highest POD number that exists in the roster. */
export const MAX_POD = Math.max(
  ...CHARACTER_IDS.map((id) => CHARACTERS[id].pod ?? 0),
);

export function charactersInPod(pod: number): CharacterDef[] {
  return CHARACTER_IDS.map((id) => CHARACTERS[id]).filter((c) => c.pod === pod);
}
