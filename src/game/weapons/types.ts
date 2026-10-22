import type { ShapeId } from '../../data/shapes';

export type WeaponId = 'TWIN_SHOT' | 'WIDE_SHOT' | 'SIDE_SHOT';

export type WeaponTag = 'spread' | 'forward' | 'lateral';

export interface ProjectileSpec {
  readonly shape: ShapeId;
  readonly size: number;
  readonly speed: number;
  readonly damage: number;
  readonly lifetime: number;
  /** Pierce budget. 1 = dies on first hit. */
  readonly maxHits: number;
}

/**
 * A declarative description of one gun. Angles are degrees with 0 = forward
 * (+Y), positive clockwise, so 180 is a rear-facing BACK SHOOTER and
 * [-90, 90] is SIDE SHOT. Expressing a blind spot (BEAM DRAGON has no forward
 * emitter) is simply an absence in the data, not a special case in code.
 */
export interface EmitterSpec {
  readonly id: string;
  readonly anglesDeg: readonly number[];
  /** Projectiles per angle, fanned across spreadDeg. */
  readonly burst: number;
  readonly spreadDeg: number;
  /** Seconds between volleys, ticked on SCALED time. */
  readonly cadence: number;
  /** 0..1 cadence offset, so stacked emitters do not all fire on one frame. */
  readonly phase: number;
  /** Muzzle offset along the facing axis. */
  readonly muzzleY: number;
  readonly projectile: ProjectileSpec;
}

/** How copy N of a weapon differs from copy 1. Stacking is unbounded. */
export type StackRule =
  | { kind: 'addBarrels'; perStack: number; spreadDeg: number }
  | { kind: 'multiplyRate'; perStack: number }
  | { kind: 'addDirections'; perStack: readonly number[] }
  | { kind: 'scaleDamage'; perStack: number };

export interface WeaponDef {
  readonly id: WeaponId;
  readonly name: string;
  readonly emitters: readonly EmitterSpec[];
  readonly stack: StackRule;
  readonly tags: readonly WeaponTag[];
  readonly pickupWeight: number;
}

/**
 * Declarative, serialisable, testable. No functions in data tables - which is
 * what keeps the 81-character roster reviewable and diffable.
 */
export interface EmitterPatch {
  readonly mulSize?: number;
  readonly mulDamage?: number;
  readonly mulCadence?: number;
  readonly mulSpeed?: number;
  readonly addBarrels?: number;
  readonly addSpreadDeg?: number;
  readonly addDirectionsDeg?: readonly number[];
}

export interface WeaponModifier {
  readonly when: { weaponId?: WeaponId; tag?: WeaponTag; minStacks?: number };
  readonly apply: EmitterPatch;
}

export interface CharacterDef {
  readonly id: string;
  readonly name: string;
  readonly shape: ShapeId;
  readonly drawSize: number;
  /** THE balance lever. Never derived from drawSize. */
  readonly hitboxRadius: number;
  readonly dragGain: number;
  /** Guns the character always has. Not self-patching. */
  readonly innate: readonly EmitterSpec[];
  /** Transforms applied to weapons the character PICKS UP. */
  readonly modifiers: readonly WeaponModifier[];
}

/** A fully-resolved emitter with mutable firing state. */
export interface RuntimeEmitter {
  anglesRad: number[];
  burst: number;
  spreadRad: number;
  cadence: number;
  cooldown: number;
  muzzleY: number;
  size: number;
  speed: number;
  damage: number;
  lifetime: number;
  maxHits: number;
  shape: ShapeId;
}

export interface CompiledLoadout {
  emitters: RuntimeEmitter[];
  /** Total barrels, for the debug overlay and the overflow rule. */
  barrels: number;
  /** Stacks beyond the geometry ceiling, folded into multipliers. */
  overflow: number;
}
