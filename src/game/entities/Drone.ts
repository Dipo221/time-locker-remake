import type { Poolable } from '../../core/pool';
import type { DroneDef, DroneKind } from '../../data/drones';
import { DRONES } from '../../data/drones';
import type { ShapeId } from '../../data/shapes';

/**
 * A persistent companion: MINE BOT, GUARD BIT or SUPPORTER.
 *
 * Deliberately NOT a projectile. These survive contact, hold station, render
 * on their own layer and have their own lifecycle; putting them in the
 * projectile pool would give it a population that never dies and make every
 * projectile loop reason about exceptions.
 */
export interface Drone extends Poolable {
  def: DroneDef;
  kind: DroneKind;
  x: number;
  y: number;
  /** Orbit phase while attached, radians. */
  angle: number;
  /** Set once it has peeled off to attack; it then flies on vx/vy. */
  launched: boolean;
  vx: number;
  vy: number;
  shape: ShapeId;
  drawSize: number;
  hitboxRadius: number;
  damage: number;
  /** SCALED seconds alive, for the SUPPORTER's conversion timer. */
  age: number;
  /** SCALED seconds until it may fire or damage again. */
  cooldown: number;
  targetRef: Poolable | null;
  targetGen: number;
}

export function createDrone(): Drone {
  return {
    alive: false,
    gen: 0,
    def: DRONES.GUARD_BIT,
    kind: 'guard',
    x: 0,
    y: 0,
    angle: 0,
    launched: false,
    vx: 0,
    vy: 0,
    shape: 'bit',
    drawSize: 1,
    hitboxRadius: 1,
    damage: 0,
    age: 0,
    cooldown: 0,
    targetRef: null,
    targetGen: -1,
  };
}

export function resetDrone(d: Drone): void {
  d.def = DRONES.GUARD_BIT;
  d.kind = 'guard';
  d.x = 0;
  d.y = 0;
  d.angle = 0;
  d.launched = false;
  d.vx = 0;
  d.vy = 0;
  d.shape = 'bit';
  d.drawSize = 1;
  d.hitboxRadius = 1;
  d.damage = 0;
  d.age = 0;
  d.cooldown = 0;
  d.targetRef = null;
  d.targetGen = -1;
}

export function applyDroneDef(d: Drone, def: DroneDef, angle: number): void {
  d.def = def;
  d.kind = def.kind;
  d.shape = def.shape;
  d.drawSize = def.drawSize;
  d.hitboxRadius = def.hitboxRadius;
  d.damage = def.damage;
  d.angle = angle;
  d.launched = false;
  d.age = 0;
  d.cooldown = 0;
}
