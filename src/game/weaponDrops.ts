import type { Rng } from '../core/rng';
import { DRONES, DRONE_IDS } from '../data/drones';
import { PROJECTILE_WEAPON_IDS, WEAPONS } from '../data/weapons';
import type { WeaponId } from './weapons/types';

/**
 * Every weapon that can be handed out at random, projectile and drone alike,
 * with its rarity. Shared by drops in a run and the lobby's weapon machine,
 * so the machine is exactly as stingy with BEAM and SUPPORTER as the field.
 */
const IDS: readonly WeaponId[] = [...PROJECTILE_WEAPON_IDS, ...DRONE_IDS];
const WEIGHTS: readonly number[] = [
  ...PROJECTILE_WEAPON_IDS.map((id) => WEAPONS[id].pickupWeight),
  ...DRONE_IDS.map((id) => DRONES[id].pickupWeight),
];

export function rollWeapon(rng: Rng): WeaponId {
  const i = rng.weighted(WEIGHTS);
  return IDS[i < 0 ? 0 : i];
}
