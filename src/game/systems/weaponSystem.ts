import type { ScaledDt } from '../../core/clock';
import type { Enemy } from '../entities/Enemy';
import type { World } from '../World';
import { emit } from '../weapons/fire';
import type { RuntimeEmitter } from '../weapons/types';

/** The player always faces up, so "forward" is always +Y. */
const FORWARD = Math.PI / 2;

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
    // A sweep keeps turning between shots, frozen with everything else.
    if (e.track === 'sweep') e.sweepPhase += dt;

    e.cooldown -= dt;
    if (e.cooldown > 0) continue;
    // Accumulate rather than assign, so a very high rate does not lose volleys.
    e.cooldown += e.cadence;
    if (e.cooldown < 0) e.cooldown = e.cadence;

    emit(w.playerShots, e, p.x, p.y, aimFor(w, e), 0, null);
  }
}

/** The absolute direction this emitter treats as "forward" right now. */
function aimFor(w: World, e: RuntimeEmitter): number {
  switch (e.track) {
    case 'nearest': {
      const t = nearestTarget(w, e);
      return t === null
        ? FORWARD
        : Math.atan2(t.y - w.player.y, t.x - w.player.x);
    }
    case 'sweep':
      return (
        FORWARD + Math.sin(e.sweepPhase * e.sweepHz * Math.PI * 2) * e.sweepRad
      );
    case 'forward':
    default:
      return FORWARD;
  }
}

/**
 * Closest enemy in range that this emitter can actually hurt. An auto-aiming
 * turret that locks onto a helicopter it cannot hit would simply stop
 * shooting at everything else, so air units are skipped unless the shots can
 * reach them.
 */
function nearestTarget(w: World, e: RuntimeEmitter): Enemy | null {
  const p = w.player;
  const pool = w.enemies;
  let best: Enemy | null = null;
  let bestD2 = e.trackRange * e.trackRange;
  for (let i = 0; i < pool.count; i++) {
    const t = pool.active[i];
    if (!t.alive) continue;
    if (t.flying && !e.hitsFlying) continue;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = t;
    }
  }
  return best;
}
