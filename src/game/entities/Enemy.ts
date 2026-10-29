import type { Poolable } from '../../core/pool';
import type { ColorRole, DropKind, EnemyDef, MoveArchetype } from '../../data/enemies';
import { ENEMIES } from '../../data/enemies';
import type { ShapeId } from '../../data/shapes';

export interface Enemy extends Poolable {
  /** Static table entry; defs are never pooled, so a direct reference is safe. */
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Render rotation. Shapes are authored facing +Y. */
  angle: number;
  hp: number;
  hitboxRadius: number;
  drawSize: number;
  shape: ShapeId;
  colorRole: ColorRole;
  archetype: MoveArchetype;
  speed: number;
  drop: DropKind;
  scoreValue: number;
  /** SCALED seconds of freeze remaining. A frozen enemy STILL KILLS on contact. */
  frozenFor: number;
  /** Phase accumulator for zigzag, in scaled seconds. */
  phase: number;
  /** Heading for straight/zigzag movement, radians. */
  heading: number;
  /** SCALED seconds until this enemy's next shot. */
  fireCooldown: number;
  /** Bosses persist until killed and drive the health bar. */
  isBoss: boolean;
  /** Starting hp, so the health bar has a denominator. */
  maxHp: number;
  /**
   * charger and hopper: SCALED seconds left in the current windup/dash or
   * pause/hop. The two archetypes share these, since a hop is just a short
   * dash with a pause in front of it.
   */
  chargeTimer: number;
  charging: boolean;
  /** Capsule length behind the head; 0 for an ordinary round enemy. */
  length: number;
  /** Air unit: only homing weapons reach it, and touching it is harmless. */
  flying: boolean;
}

export function createEnemy(): Enemy {
  return {
    alive: false,
    gen: 0,
    def: ENEMIES[0],
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    hp: 1,
    hitboxRadius: 1,
    drawSize: 1,
    shape: 'penguin',
    colorRole: 'black',
    archetype: 'straight',
    speed: 0,
    drop: 'none',
    scoreValue: 0,
    frozenFor: 0,
    phase: 0,
    heading: 0,
    fireCooldown: 0,
    isBoss: false,
    maxHp: 1,
    chargeTimer: 0,
    charging: false,
    length: 0,
    flying: false,
  };
}

export function resetEnemy(e: Enemy): void {
  e.def = ENEMIES[0];
  e.x = 0;
  e.y = 0;
  e.vx = 0;
  e.vy = 0;
  e.angle = 0;
  e.hp = 1;
  e.hitboxRadius = 1;
  e.drawSize = 1;
  e.shape = 'penguin';
  e.colorRole = 'black';
  e.archetype = 'straight';
  e.speed = 0;
  e.drop = 'none';
  e.scoreValue = 0;
  e.frozenFor = 0;
  e.phase = 0;
  e.heading = 0;
  e.fireCooldown = 0;
  e.isBoss = false;
  e.maxHp = 1;
  e.chargeTimer = 0;
  e.charging = false;
  e.length = 0;
  e.flying = false;
}

/** Apply a table entry to a freshly spawned enemy. */
export function applyDef(e: Enemy, def: EnemyDef): void {
  e.def = def;
  e.hp = def.hp;
  e.hitboxRadius = def.hitboxRadius;
  e.drawSize = def.drawSize;
  e.shape = def.shape;
  e.colorRole = def.colorRole;
  e.archetype = def.archetype;
  e.speed = def.speed;
  e.drop = def.drop;
  e.scoreValue = def.scoreValue;
  e.fireCooldown =
    def.weapon === undefined ? 0 : def.weapon.cadence * def.weapon.phase;
  e.isBoss = def.isBoss === true;
  e.maxHp = def.hp;
  e.chargeTimer = def.chargeWindup ?? def.hopPause ?? 0;
  e.charging = false;
  e.length = def.length ?? 0;
  e.flying = def.flying === true;
}
