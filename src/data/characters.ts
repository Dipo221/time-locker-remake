import {
  BASE_BULLET_DAMAGE,
  BASE_BULLET_LIFETIME,
  BASE_BULLET_SIZE,
  BASE_BULLET_SPEED,
  BASE_FIRE_CADENCE,
} from '../config';
import type { CharacterDef, EmitterSpec } from '../game/weapons/types';

const BASE_SHOT: EmitterSpec = {
  id: 'base',
  anglesDeg: [0],
  burst: 1,
  spreadDeg: 0,
  cadence: BASE_FIRE_CADENCE,
  phase: 0,
  muzzleY: 16,
  projectile: {
    shape: 'bulletLong',
    size: BASE_BULLET_SIZE,
    speed: BASE_BULLET_SPEED,
    damage: BASE_BULLET_DAMAGE,
    lifetime: BASE_BULLET_LIFETIME,
    maxHits: 1,
  },
};

/**
 * Milestone 1 ships 3 of the original's 81. They are chosen to exercise all
 * three axes the data model has to express, so that adding the other 78 really
 * is data entry:
 *
 *   THE LOCKER  - a character whose entire identity is its hitbox.
 *   WIDE RHINO  - a character that TRANSFORMS a weapon it picks up.
 *   ANT BEAR    - a character with no gun at all, and the smallest hitbox.
 *
 * Select with ?char=wideRhino until the lobby exists.
 */
export const CHARACTERS: Record<string, CharacterDef> = {
  /** The starting character: weak gun, smallest hitbox, unlimited use. */
  theLocker: {
    id: 'theLocker',
    name: 'THE LOCKER',
    shape: 'locker',
    drawSize: 40,
    hitboxRadius: 9,
    dragGain: 1.0,
    innate: [BASE_SHOT],
    modifiers: [],
  },

  /**
   * Starts with WIDE SHOT built in, and makes every WIDE SHOT it picks up
   * bigger and harder-hitting. The modifier is the whole character.
   */
  wideRhino: {
    id: 'wideRhino',
    name: 'WIDE RHINO',
    shape: 'bear',
    drawSize: 48,
    hitboxRadius: 14,
    dragGain: 1.0,
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
          ...BASE_SHOT.projectile,
          size: BASE_BULLET_SIZE * 1.6,
          damage: BASE_BULLET_DAMAGE * 1.3,
        },
      },
    ],
    modifiers: [
      { when: { weaponId: 'WIDE_SHOT' }, apply: { mulSize: 1.8, mulDamage: 1.3 } },
    ],
  },

  /**
   * No weapon whatsoever, and the smallest hitbox in the game. Proof that a
   * character can be defined by two numbers and an empty array.
   */
  antBear: {
    id: 'antBear',
    name: 'ANT BEAR',
    shape: 'dog',
    drawSize: 30,
    hitboxRadius: 4,
    dragGain: 1.0,
    innate: [],
    modifiers: [],
  },
};

export const DEFAULT_CHARACTER = 'theLocker';
