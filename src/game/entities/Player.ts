import {
  PLAYER_DRAG_GAIN,
  PLAYER_DRAW_SIZE,
  PLAYER_HITBOX_DEFAULT,
} from '../../config';
import type { ShapeId } from '../../data/shapes';

export interface Player {
  x: number;
  y: number;
  /**
   * Collision ALWAYS reads this, never drawSize. The hitbox being much smaller
   * than the silhouette is the primary balance lever across the whole roster
   * (ANT BEAR 4 vs drawn 20); deriving it from draw size would flatten all 81
   * characters into one.
   */
  hitboxRadius: number;
  drawSize: number;
  shape: ShapeId;
  /** Per-character drag responsiveness; heavier characters are below 1. */
  dragGain: number;
  alive: boolean;
  /** REAL seconds. Ticks down even while time is frozen, as in the original. */
  invulnRealFor: number;
  /** SCALED seconds until the next volley. */
  fireCooldown: number;
  /** Instantaneous world speed, for the debug overlay and feel checks. */
  speed: number;
  /**
   * Distance travelled THIS FRAME. Pursuers need this rather than `speed`
   * because the player moves on the real clock while they move on the scaled
   * one, so comparing speeds directly is wrong whenever time is dilated.
   */
  stepDist: number;
}

export function createPlayer(): Player {
  return {
    x: 0,
    y: 0,
    hitboxRadius: PLAYER_HITBOX_DEFAULT,
    drawSize: PLAYER_DRAW_SIZE,
    shape: 'locker',
    dragGain: PLAYER_DRAG_GAIN,
    alive: true,
    invulnRealFor: 0,
    fireCooldown: 0,
    speed: 0,
    stepDist: 0,
  };
}
