import type { Poolable } from '../../core/pool';

/**
 * Chunky pixel splatter. Axis-aligned squares, no rotation, one fillRect each.
 *
 * Particles update on SCALED time, so a burst hangs frozen in mid-air when the
 * player stops. That is the game's visual signature, not a bug - do not "fix"
 * it to use the real clock.
 *
 * The original was criticised for particles so coarse that debris was hard to
 * tell from incoming fire, so these are deliberately small and never use the
 * reserved enemy-fire hue.
 */
export interface Particle extends Poolable {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Remaining SCALED seconds. */
  life: number;
  maxLife: number;
  /** Index into the particle colour table, so draws can be batched by colour. */
  colorIndex: number;
}

export function createParticle(): Particle {
  return {
    alive: false,
    gen: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    life: 0,
    maxLife: 1,
    colorIndex: 0,
  };
}

export function resetParticle(p: Particle): void {
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.size = 0;
  p.life = 0;
  p.maxLife = 1;
  p.colorIndex = 0;
}

/** Draw colours, indexed by Particle.colorIndex. Never the enemy-fire hue. */
export const PARTICLE_COLORS: readonly string[] = [
  '#262a30', // black enemies
  '#f08a1e', // orange
  '#8b4bd8', // purple
  '#2eb872', // green
  '#2b6cf6', // blue crates
  '#1e2024', // the player
];

export function colorIndexFor(role: string): number {
  switch (role) {
    case 'orange':
      return 1;
    case 'purple':
      return 2;
    case 'green':
      return 3;
    case 'blue':
      return 4;
    default:
      return 0;
  }
}
