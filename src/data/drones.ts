import type { ShapeId } from './shapes';
import type { DroneWeaponId, ShotFamily } from '../game/weapons/types';

/**
 * The three companion weapons. They persist, orbit the player, and are not
 * projectiles - see the note on DroneWeaponId.
 *
 * One drone exists per stack held, so these scale by COUNT rather than by
 * barrels, which is why they sit outside the loadout compiler entirely.
 */
export type DroneKind = 'mine' | 'guard' | 'supporter';

export interface DroneDef {
  readonly id: DroneWeaponId;
  readonly name: string;
  readonly kind: DroneKind;
  readonly shape: ShapeId;
  /** Colour, by the same rule as shots: what it does to an enemy. */
  readonly family: ShotFamily;
  readonly drawSize: number;
  readonly hitboxRadius: number;
  readonly orbitRadius: number;
  readonly orbitSpeedDeg: number;
  readonly damage: number;
  readonly pickupWeight: number;
  /** mine, supporter: how far it looks for a target. */
  readonly seekRadius?: number;
  /** mine, supporter: speed once it leaves orbit. */
  readonly launchSpeed?: number;
  /** mine, supporter: blast on arrival. */
  readonly explodeRadius?: number;
  readonly explodeDamage?: number;
  /** mine: seconds before a spent one is replaced. */
  readonly respawnSec?: number;
  /** supporter: seconds of covering fire before it becomes a missile. */
  readonly convertSec?: number;
  /** supporter: seconds between its shots. */
  readonly fireCadence?: number;
  /** guard: seconds between damage ticks on the same contact. */
  readonly tickSec?: number;
}

export const DRONES: Record<DroneWeaponId, DroneDef> = {
  /**
   * Mines hover around you, then peel off to chase anything that comes close
   * and detonate on it. The source rates its defensive performance highest of
   * the three and its drop rate lowest of all twelve weapons.
   */
  MINE_BOT: {
    id: 'MINE_BOT',
    name: 'MINE BOT',
    kind: 'mine',
    shape: 'mine',
    family: 'explosive',
    drawSize: 17,
    hitboxRadius: 9,
    orbitRadius: 62,
    orbitSpeedDeg: 85,
    damage: 3,
    pickupWeight: 4,
    seekRadius: 190,
    launchSpeed: 430,
    explodeRadius: 62,
    explodeDamage: 3,
    respawnSec: 2.6,
  },

  /**
   * A bit that never leaves its orbit: a moving wall that shreds anything it
   * brushes. Rated weak in raw power but excellent against the small enemies
   * that would otherwise reach you.
   */
  GUARD_BIT: {
    id: 'GUARD_BIT',
    name: 'GUARD BIT',
    kind: 'guard',
    shape: 'bit',
    family: 'pierce',
    drawSize: 15,
    hitboxRadius: 11,
    orbitRadius: 46,
    orbitSpeedDeg: 215,
    damage: 1,
    pickupWeight: 4,
    tickSec: 0.22,
  },

  /**
   * Covering fire first, guided missile second. The source could not even
   * rate its drop rate - one guide author never saw one across a 50,000-point
   * run - so it is the rarest thing in the game by a wide margin.
   */
  SUPPORTER: {
    id: 'SUPPORTER',
    name: 'SUPPORTER',
    kind: 'supporter',
    shape: 'supporter',
    family: 'basic',
    drawSize: 19,
    hitboxRadius: 8,
    orbitRadius: 78,
    orbitSpeedDeg: 60,
    damage: 1,
    pickupWeight: 2,
    seekRadius: 460,
    launchSpeed: 520,
    explodeRadius: 70,
    explodeDamage: 4,
    convertSec: 9,
    fireCadence: 0.55,
  },
};

export const DRONE_IDS = Object.keys(DRONES) as DroneWeaponId[];

export function getDrone(id: string): DroneDef | undefined {
  return (DRONES as Record<string, DroneDef | undefined>)[id];
}
