import { LOADOUT_MAX_BARRELS, LOADOUT_MAX_EMITTERS } from '../../config';
import { getDrone } from '../../data/drones';
import { getProjectileWeapon } from '../../data/weapons';
import { DEG } from '../../core/math';
import type {
  CharacterDef,
  CompiledLoadout,
  EmitterPatch,
  EmitterSpec,
  ProjectileSpec,
  RuntimeEmitter,
  ShotFamily,
  WeaponDef,
  WeaponId,
} from './types';

/**
 * Turns "this character, holding this multiset of pickups" into flat runtime
 * emitters. Called ONLY when the loadout changes - never per frame.
 *
 * Pipeline, in order:
 *   1. character innate emitters (not self-patching)
 *   2. for each held weapon: its emitters, with the StackRule applied for
 *      copies 2..n
 *   3. every matching character modifier patched over the result
 *   4. the overflow rule
 *
 * THE OVERFLOW RULE. The original stacks without limit, and so does this - but
 * unbounded stacks must not mean unbounded draw calls and unbounded
 * projectiles. Past the geometry ceiling, barrels are scaled down to fit and
 * each emitter's damage is multiplied by exactly the ratio of barrels it lost,
 * so the firepower those barrels represented is preserved rather than thrown
 * away.
 *
 * The contract that falls out, and the one the tests assert, is:
 *
 *     total DPS is strictly increasing in stack count,
 *     while total barrels never exceeds LOADOUT_MAX_BARRELS.
 *
 * Compensating is not a detail. An earlier version simply refused emitters
 * that did not fit, which meant that past about ten stacks of everything the
 * loadout collapsed back to the character's innate gun - picking up more
 * weapons made you catastrophically weaker.
 */
export function compileLoadout(
  char: CharacterDef,
  stacks: ReadonlyMap<WeaponId, number>,
): CompiledLoadout {
  const out: RuntimeEmitter[] = [];

  const push = (spec: EmitterSpec, patch: EmitterPatch | null): void => {
    if (out.length >= LOADOUT_MAX_EMITTERS) return;
    out.push(materialise(spec, patch));
  };

  // Innate guns are not self-patching: a character does not modify itself.
  for (const spec of char.innate) push(spec, null);

  for (const [id, n] of stacks) {
    if (n <= 0) continue;
    // Drones are also held as stacks but are not fired, so they are simply
    // absent here and handled by the drone controller instead.
    const def = getProjectileWeapon(id);
    if (def === undefined) continue;

    const patch = modifierFor(char, def, n);
    for (const spec of def.emitters) push(applyStackRule(spec, def, n), patch);
  }

  // --- geometry ceiling ----------------------------------------------------
  let intended = 0;
  for (const e of out) intended += e.anglesRad.length * e.burst;

  let barrels = intended;
  let overflow = 0;

  if (intended > LOADOUT_MAX_BARRELS) {
    const k = LOADOUT_MAX_BARRELS / intended;
    barrels = 0;
    for (const e of out) {
      const want = e.burst;
      // Floor, not round: rounding up can push the total back over the
      // ceiling. Flooring can only undershoot, and the damage compensation
      // below gives the lost barrels back as firepower anyway.
      const got = Math.max(1, Math.floor(want * k));
      e.burst = got;
      // Exactly compensate the barrels we just removed.
      e.damage *= want / got;
      // Grow slightly, so an overflowing loadout reads as heavier on screen.
      e.size *= Math.min(1.5, 1 + (want / got - 1) * 0.06);
      barrels += e.anglesRad.length * got;
    }
    overflow = intended - barrels;
  }

  return { emitters: out, barrels, overflow };
}

function applyStackRule(
  spec: EmitterSpec,
  def: WeaponDef,
  n: number,
): EmitterSpec {
  const extra = n - 1;
  if (extra <= 0) return spec;

  switch (def.stack.kind) {
    case 'addBarrels':
      return {
        ...spec,
        burst: spec.burst + def.stack.perStack * extra,
        spreadDeg: spec.spreadDeg + def.stack.spreadDeg * extra,
      };
    case 'multiplyRate':
      return { ...spec, cadence: spec.cadence / (1 + def.stack.perStack * extra) };
    case 'addDirections': {
      const added: number[] = [];
      for (let i = 0; i < extra; i++) {
        for (const a of def.stack.perStack) added.push(a * (i + 1));
      }
      return { ...spec, anglesDeg: [...spec.anglesDeg, ...added] };
    }
    case 'scaleDamage':
      return {
        ...spec,
        projectile: {
          ...spec.projectile,
          damage: spec.projectile.damage * Math.pow(def.stack.perStack, extra),
        },
      };
  }
}

/** First matching character modifier wins. */
function modifierFor(
  char: CharacterDef,
  def: WeaponDef,
  stacks: number,
): EmitterPatch | null {
  for (const m of char.modifiers) {
    if (m.when.weaponId !== undefined && m.when.weaponId !== def.id) continue;
    if (m.when.tag !== undefined && !def.tags.includes(m.when.tag)) continue;
    if (m.when.minStacks !== undefined && stacks < m.when.minStacks) continue;
    return m.apply;
  }
  return null;
}

/**
 * Compile one standalone emitter, with no stacking and no character modifiers.
 * Enemy weapons come through here: same type, same pool, same firing code as
 * the player's guns.
 */
export function compileEmitter(spec: EmitterSpec): RuntimeEmitter {
  return materialise(spec, null);
}

function materialise(
  spec: EmitterSpec,
  patch: EmitterPatch | null,
): RuntimeEmitter {
  const p = spec.projectile;
  const angles = [...spec.anglesDeg];
  if (patch?.addDirectionsDeg) angles.push(...patch.addDirectionsDeg);

  return {
    anglesRad: angles.map((d) => d * DEG),
    burst: Math.max(1, spec.burst + (patch?.addBarrels ?? 0)),
    spreadRad: (spec.spreadDeg + (patch?.addSpreadDeg ?? 0)) * DEG,
    cadence: Math.max(0.02, spec.cadence * (patch?.mulCadence ?? 1)),
    // Stagger the first volley so stacked emitters do not all fire on frame 1.
    cooldown: spec.cadence * spec.phase,
    muzzleY: spec.muzzleY,
    size: p.size * (patch?.mulSize ?? 1),
    speed: p.speed * (patch?.mulSpeed ?? 1),
    damage: p.damage * (patch?.mulDamage ?? 1),
    lifetime: p.lifetime,
    maxHits: p.maxHits,
    shape: p.shape,
    behaviours: p.behaviours ?? null,
    // The source: air units "can only be hit by some homing weapons". Rather
    // than tag weapons by hand, anything that steers onto its target counts,
    // so a new homing weapon reaches helicopters without remembering to.
    hitsFlying:
      p.hitsFlying ?? (p.behaviours ?? []).some((b) => b.kind === 'homing'),
    family: shotFamily(p),
    track: spec.track ?? 'forward',
    trackRange: spec.trackRange ?? 520,
    sweepRad: (spec.sweepDeg ?? 0) * DEG,
    sweepHz: spec.sweepHz ?? 0.5,
    // Stagger sweeping emitters too, so two do not mirror each other exactly.
    sweepPhase: spec.phase,
  };
}

/**
 * Which colour a shot wears, from what it does. The first match wins, in
 * order of how much the effect changes play: a freezing shot is ice even if
 * it pierces, and a MISSILE is explosive even though it also homes - the bang
 * is what you need to know about. Bouncing shots seek their next target, so
 * they read as homing; splitting ones burst, so they read as explosive.
 */
export function shotFamily(p: ProjectileSpec): ShotFamily {
  const kinds = (p.behaviours ?? []).map((b) => b.kind);
  if (kinds.includes('freezing')) return 'ice';
  if (kinds.includes('explodeOnHit') || kinds.includes('splitOnHit')) {
    return 'explosive';
  }
  if (kinds.includes('homing') || kinds.includes('bounce')) return 'homing';
  if (p.maxHits > 1) return 'pierce';
  return 'basic';
}

/** The colour a held weapon goes by in the HUD: that of what it fires. */
export function weaponFamily(id: WeaponId): ShotFamily {
  const def = getProjectileWeapon(id);
  if (def !== undefined) return shotFamily(def.emitters[0].projectile);
  return getDrone(id)?.family ?? 'basic';
}
