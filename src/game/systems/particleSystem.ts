import type { ScaledDt } from '../../core/clock';
import { PARTICLE_MAX, PARTICLE_MIN } from '../../config';
import type { Pool } from '../../core/pool';
import type { Rng } from '../../core/rng';
import type { Particle } from '../entities/Particle';
import { colorIndexFor } from '../entities/Particle';

/** Velocity decay per second, applied in scaled time. */
const DRAG = 2.6;

export function updateParticles(pool: Pool<Particle>, dt: ScaledDt): void {
  if (dt === 0) return; // frozen splatter hangs in the air. This is the look.

  const decay = Math.exp(-DRAG * dt);
  for (let i = 0; i < pool.count; i++) {
    const p = pool.active[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= decay;
    p.vy *= decay;
  }
}

export function burst(
  pool: Pool<Particle>,
  rng: Rng,
  x: number,
  y: number,
  count: number,
  speed: number,
  colorRole: string,
): void {
  const ci = colorIndexFor(colorRole);
  for (let i = 0; i < count; i++) {
    const p = pool.spawn();
    // Particles fail soft in the other direction from projectiles: if the pool
    // is full we simply stop, because a missing shard is invisible.
    if (p === null) return;
    const a = rng.next() * Math.PI * 2;
    const s = speed * (0.25 + rng.next() * 0.75);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.size = PARTICLE_MIN + rng.next() * (PARTICLE_MAX - PARTICLE_MIN);
    p.maxLife = 0.35 + rng.next() * 0.5;
    p.life = p.maxLife;
    p.colorIndex = ci;
  }
}
