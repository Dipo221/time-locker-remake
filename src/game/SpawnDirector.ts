import type { ScaledDt } from '../core/clock';
import {
  CAP_BASE,
  CAP_MAX,
  CAP_STEP,
  SIDE_BANDS,
  SPAWN_AIM_JITTER_DEG,
  SPAWN_BASE,
  SPAWN_BOTTOM_MIN_GAP,
  SPAWN_HALVING_SCORE,
  SPAWN_MARGIN,
  SPAWN_MIN,
  SPAWN_MIN_PLAYER_DIST,
  VIEW_H,
  VIEW_W,
} from '../config';
import { DEG } from '../core/math';
import type { Rng } from '../core/rng';
import type { EnemyDef } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import { applyDef } from './entities/Enemy';
import type { World } from './World';

type Side = 0 | 1 | 2 | 3; // top, left, right, bottom

/**
 * Difficulty is driven by SCORE, not elapsed time, because score is the game's
 * difficulty currency and because a player who stops moving should not
 * accumulate a wall of enemies while frozen.
 *
 * It ticks on SCALED time for the same reason: standing still is already
 * punished by the darkness, and double-punishing it would kill the "survey the
 * frozen battlefield" fantasy the whole mechanic exists to sell.
 */
export class SpawnDirector {
  private timer = 0;
  private readonly weights: number[] = [];

  reset(): void {
    this.timer = SPAWN_BASE * 0.5;
  }

  interval(score: number): number {
    return Math.max(
      SPAWN_MIN,
      SPAWN_BASE * Math.pow(0.5, score / SPAWN_HALVING_SCORE),
    );
  }

  cap(score: number): number {
    return Math.min(CAP_MAX, CAP_BASE + Math.floor(score / CAP_STEP));
  }

  sideWeights(score: number): readonly [number, number, number, number] {
    let band = SIDE_BANDS[0];
    for (const b of SIDE_BANDS) if (score >= b.at) band = b;
    return band.w;
  }

  update(w: World, dt: ScaledDt): void {
    if (dt === 0) return;
    if (w.phase !== 'playing') return;

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer += this.interval(w.score);

    if (w.enemies.count >= this.cap(w.score)) return;

    const def = this.roll(w.score, w.rng);
    if (def === null) return;

    this.spawn(w, def);
  }

  private roll(score: number, rng: Rng): EnemyDef | null {
    this.weights.length = 0;
    const pool: EnemyDef[] = [];
    for (const e of ENEMIES) {
      if (score < e.minScore) continue;
      pool.push(e);
      this.weights.push(e.spawnWeight);
    }
    if (pool.length === 0) return null;
    const i = rng.weighted(this.weights);
    return i < 0 ? null : pool[i];
  }

  private spawn(w: World, def: EnemyDef): void {
    const rng = w.rng;
    const camY = w.camera.y;
    const top = camY + VIEW_H / 2 + SPAWN_MARGIN;
    const bottom = camY - VIEW_H / 2 - SPAWN_MARGIN;

    const sw = this.sideWeights(w.score);
    let side = rng.weighted(sw) as Side;
    if (side < 0) side = 0;

    // Never let anything crawl out of the black: a spawn the player cannot see
    // coming and cannot reach is just an unfair death.
    if (side === 3 && w.darkness.gapTo(w.player.y) < SPAWN_BOTTOM_MIN_GAP) {
      side = 0;
    }

    let x = 0;
    let y = 0;
    switch (side) {
      case 0:
        x = rng.range(20, VIEW_W - 20);
        y = top;
        break;
      case 1:
        x = -SPAWN_MARGIN;
        y = rng.range(bottom + 140, top - 60);
        break;
      case 2:
        x = VIEW_W + SPAWN_MARGIN;
        y = rng.range(bottom + 140, top - 60);
        break;
      case 3:
        x = rng.range(20, VIEW_W - 20);
        y = Math.max(bottom, w.darkness.y + 30);
        break;
    }

    // An unavoidable spawn-kill in a one-hit game is unforgivable.
    const dx = x - w.player.x;
    const dy = y - w.player.y;
    if (dx * dx + dy * dy < SPAWN_MIN_PLAYER_DIST * SPAWN_MIN_PLAYER_DIST) {
      return;
    }

    const e = w.enemies.spawn();
    if (e === null) return; // at cap; the director already checked, be safe

    applyDef(e, def);
    e.x = x;
    e.y = y;
    e.phase = rng.next() * 10;

    // Aim inward, with jitter so formations do not look stamped out.
    const toPlayer = Math.atan2(w.player.y - y, w.player.x - x);
    const jitter = (rng.next() - 0.5) * 2 * SPAWN_AIM_JITTER_DEG * DEG;
    const heading =
      def.archetype === 'drift'
        ? -Math.PI / 2 + (rng.next() - 0.5) * 0.5 // crates drift downward
        : toPlayer + jitter;

    e.heading = heading;
    e.vx = Math.cos(heading) * def.speed;
    e.vy = Math.sin(heading) * def.speed;
    e.angle = heading - Math.PI / 2;
  }
}
