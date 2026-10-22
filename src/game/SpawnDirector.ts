import type { ScaledDt } from '../core/clock';
import {
  BOSS_CONCURRENT_PER_DEFEATS,
  BOSS_GAP_AFTER_SPAWN,
  BOSS_HP_SCALE_BASE,
  BOSS_HP_SQRT_DIVISOR,
  BOSS_MAX_CONCURRENT,
  BOSS_SUPPRESSION,
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
  FLAGS,
  VIEW_H,
  VIEW_W,
} from '../config';
import { DEG } from '../core/math';
import type { Rng } from '../core/rng';
import { BOSSES } from '../data/bosses';
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
  /** Avoids meeting the same boss twice in a row. */
  private lastBossId = '';

  reset(): void {
    this.timer = SPAWN_BASE * 0.5;
    this.lastBossId = '';
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

  /**
   * How many bosses may be on screen at once. Grows with how many the player
   * has actually beaten, so a long run eventually sees the next one arrive
   * before the current is finished - escalation, not a scheduling accident.
   */
  maxConcurrentBosses(defeated: number): number {
    return Math.min(
      BOSS_MAX_CONCURRENT,
      1 + Math.floor(defeated / BOSS_CONCURRENT_PER_DEFEATS),
    );
  }

  update(w: World, dt: ScaledDt): void {
    if (dt === 0) return;
    if (w.phase !== 'playing') return;

    const bosses = w.countBosses();

    if (
      FLAGS.bosses &&
      w.score >= w.nextBossScore &&
      bosses < this.maxConcurrentBosses(w.bossesDefeated)
    ) {
      this.spawnBoss(w);
      return;
    }

    // While a boss is up, the rank and file thin out. A boss fight you cannot
    // see through because the screen is full of penguins is not a boss fight.
    this.timer -= bosses === 0 ? dt : dt * BOSS_SUPPRESSION;
    if (this.timer > 0) return;
    this.timer += this.interval(w.score);

    const room = this.cap(w.score) - w.enemies.count;
    if (room <= 0) return;

    const def = this.roll(w.score, w.rng);
    if (def === null) return;

    this.spawn(w, def, room);
  }

  /**
   * How many of this type arrive together. Flocking types also grow with
   * score; lone types (bears, crates) stay lone however far you get, because
   * a wall of bears is not a difficulty curve, it is a brick wall.
   */
  private groupSize(def: EnemyDef, score: number, rng: Rng): number {
    const lo = def.groupMin ?? 1;
    const hi = def.groupMax ?? 1;
    if (hi <= 1) return 1;
    const bonus = Math.min(3, Math.floor(score / 650));
    return lo + rng.int(hi - lo + 1) + bonus;
  }

  /**
   * Bosses enter from well above the view, so they are visible on approach
   * rather than materialising on top of the player. Health scales with how
   * many you have already beaten: a fixed pool would melt instantly once the
   * player's unbounded weapon stacking gets going, and bosses would stop
   * being events.
   */
  private spawnBoss(w: World): void {
    const pool = BOSSES.filter((b) => b.id !== this.lastBossId);
    const def = pool[w.rng.int(pool.length)] ?? BOSSES[0];

    const e = w.enemies.spawn();
    if (e === null) return;

    applyDef(e, def);
    // Scaled by score, not by how many bosses have been met: score tracks how
    // much weaponry the player has stacked up, which is what actually decides
    // the fight.
    const scale =
      BOSS_HP_SCALE_BASE + Math.sqrt(w.score) / BOSS_HP_SQRT_DIVISOR;
    e.hp = Math.round(def.hp * scale);
    e.maxHp = e.hp;

    e.x = VIEW_W / 2 + (w.rng.next() - 0.5) * 120;
    e.y = w.camera.y + VIEW_H / 2 + 180;
    e.heading = -Math.PI / 2;
    e.vx = 0;
    e.vy = -def.speed;
    e.angle = e.heading - Math.PI / 2;
    if (def.weapon !== undefined) {
      e.fireCooldown = def.weapon.cadence;
    }

    this.lastBossId = def.id;
    w.bossesSpawned++;
    // Hold the next one off even if the threshold is already passed, so two
    // cannot arrive on the same frame once concurrency allows more than one.
    w.nextBossScore = Math.max(
      w.nextBossScore,
      w.score + w.bossGap() * BOSS_GAP_AFTER_SPAWN,
    );
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

  private spawn(w: World, def: EnemyDef, room: number): void {
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

    // Aim inward, with jitter so formations do not look stamped out.
    const toPlayer = Math.atan2(w.player.y - y, w.player.x - x);
    const jitter = (rng.next() - 0.5) * 2 * SPAWN_AIM_JITTER_DEG * DEG;
    let heading: number;
    if (def.archetype === 'drift') {
      heading = -Math.PI / 2 + (rng.next() - 0.5) * 0.5; // crates drift downward
    } else if (def.archetype === 'turret') {
      // Turrets never move, and their firing axis is read off the heading, so
      // it is pinned to +Y: the vertical turret's 0/180 then fires up and
      // down, and the horizontal one's 90/270 fires across the corridor.
      heading = Math.PI / 2;
    } else {
      heading = toPlayer + jitter;
    }

    // Lay the group out in a row ACROSS the direction of travel, so it reads
    // as an advancing line rather than a single-file queue.
    const n = Math.min(this.groupSize(def, w.score, rng), room);
    const spacing = def.drawSize * 1.45;
    const perpX = -Math.sin(heading);
    const perpY = Math.cos(heading);

    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spacing;
      const ex = x + perpX * off;
      const ey = y + perpY * off;

      // An unavoidable spawn-kill in a one-hit game is unforgivable, so this
      // is checked per member - a row is wide enough that one end can be
      // clear while the other is on top of the player.
      const dx = ex - w.player.x;
      const dy = ey - w.player.y;
      if (dx * dx + dy * dy < SPAWN_MIN_PLAYER_DIST * SPAWN_MIN_PLAYER_DIST) {
        continue;
      }

      const e = w.enemies.spawn();
      if (e === null) return;

      applyDef(e, def);
      e.x = ex;
      e.y = ey;
      e.phase = rng.next() * 10;
      e.heading = heading;
      e.vx = Math.cos(heading) * def.speed;
      e.vy = Math.sin(heading) * def.speed;
      e.angle = heading - Math.PI / 2;

      // Desynchronise a group's guns, so four infantry do not fire as one
      // volley you either dodge entirely or not at all.
      if (def.weapon !== undefined) {
        e.fireCooldown += rng.next() * def.weapon.cadence * 0.7;
      }
    }
  }
}
