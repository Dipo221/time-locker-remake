import type { ScaledDt } from '../../core/clock';
import type { World } from '../World';
import { emit } from '../weapons/fire';

/**
 * The player's guns run on the SCALED clock, so a frozen player fires nothing.
 * There is no special case for that anywhere - it falls out of the clock split
 * for free, which is a good sign the architecture is right.
 *
 * Emitter angles are 0 = forward (+Y), positive clockwise. The direction
 * vector is therefore (sin a, cos a), and the draw rotation is -a (rotating a
 * +Y-facing shape by -a aims it along that vector).
 */
export function updatePlayerGuns(w: World, dt: ScaledDt): void {
  if (dt === 0) return;
  const p = w.player;
  if (!p.alive) return;

  const emitters = w.loadout.emitters;
  for (let i = 0; i < emitters.length; i++) {
    const e = emitters[i];
    e.cooldown -= dt;
    if (e.cooldown > 0) continue;
    // Accumulate rather than assign, so a very high rate does not lose volleys.
    e.cooldown += e.cadence;
    if (e.cooldown < 0) e.cooldown = e.cadence;
    // The player always faces up, so "forward" is always +Y.
    emit(w.playerShots, e, p.x, p.y, Math.PI / 2, 0, null);
  }
}
