import type { ShapeId } from '../../data/shapes';
import type { BehaviourSpec } from '../behaviours';

/** Weapons that fire projectiles. */
export type ProjectileWeaponId =
  | 'TWIN_SHOT'
  | 'WIDE_SHOT'
  | 'SIDE_SHOT'
  | 'HOMING_SHOT'
  | 'ROCKET'
  | 'BEAM'
  | 'ICE_CANON'
  | 'MISSILE'
  | 'LINE';

/**
 * Weapons that are persistent companions rather than shots. They orbit the
 * player, survive contact, render on their own layer and have their own
 * lifecycle - conflating them with projectiles would produce a pool where
 * half the entries never die.
 */
export type DroneWeaponId = 'MINE_BOT' | 'GUARD_BIT' | 'SUPPORTER';

export type WeaponId = ProjectileWeaponId | DroneWeaponId;

export type WeaponTag =
  | 'spread'
  | 'forward'
  | 'lateral'
  | 'homing'
  | 'rocket'
  | 'ice'
  | 'beam'
  | 'drone'
  | 'barrier';

export interface ProjectileSpec {
  readonly shape: ShapeId;
  readonly size: number;
  readonly speed: number;
  readonly damage: number;
  readonly lifetime: number;
  /** Pierce budget. 1 = dies on first hit; Infinity for a beam. */
  readonly maxHits: number;
  /** Optional steering/effect behaviours, applied in order. */
  readonly behaviours?: readonly BehaviourSpec[];
  /**
   * Override for whether this can reach air units. Normally derived - anything
   * that homes can - but PANDA's bears home onto their prey and the source is
   * explicit that they cannot hit helicopters, so the rule needs an escape.
   */
  readonly hitsFlying?: boolean;
}

/**
 * Where an emitter points.
 *   forward  straight ahead (the default, and nearly everything)
 *   nearest  at the closest enemy - an auto-aiming turret
 *   sweep    back and forth across an arc - a rotating gun
 */
export type TrackMode = 'forward' | 'nearest' | 'sweep';

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
  readonly track?: TrackMode;
  /** nearest: how far it looks. Falls back to forward with nothing in range. */
  readonly trackRange?: number;
  /** sweep: half-width of the arc in degrees, and how fast it crosses it. */
  readonly sweepDeg?: number;
  readonly sweepHz?: number;
}

/** How copy N of a weapon differs from copy 1. Stacking is unbounded. */
export type StackRule =
  | { kind: 'addBarrels'; perStack: number; spreadDeg: number }
  | { kind: 'multiplyRate'; perStack: number }
  | { kind: 'addDirections'; perStack: readonly number[] }
  | { kind: 'scaleDamage'; perStack: number };

export interface WeaponDef {
  readonly id: ProjectileWeaponId;
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
  /** Stacks granted at the start of every run (MINE LOCKER's two mines). */
  readonly startWeapons?: readonly WeaponId[];
  /**
   * Which vending machine dispenses this. Undefined means it is not in the
   * gacha at all - either free from the start, or bought outright.
   */
  readonly pod?: number;
  /** Shown in the lobby as the character's one-line identity. */
  readonly blurb?: string;
}

/**
 * What a player shot DOES, which is what its colour says (see SHOT_COLORS).
 * Derived from the projectile's behaviours, never hand-assigned, so every
 * character's innate gun gets the right colour without anyone remembering to.
 */
export type ShotFamily = 'basic' | 'homing' | 'explosive' | 'pierce' | 'ice';

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
  behaviours: readonly BehaviourSpec[] | null;
  /** Can reach air units. True exactly when it homes; see Enemy.flying. */
  hitsFlying: boolean;
  family: ShotFamily;
  track: TrackMode;
  trackRange: number;
  sweepRad: number;
  sweepHz: number;
  /** SCALED seconds of sweep elapsed; mutable firing state like cooldown. */
  sweepPhase: number;
}

export interface CompiledLoadout {
  emitters: RuntimeEmitter[];
  /** Total barrels, for the debug overlay and the overflow rule. */
  barrels: number;
  /** Stacks beyond the geometry ceiling, folded into multipliers. */
  overflow: number;
}
