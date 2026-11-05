import type { ScaledDt } from '../core/clock';
import {
  BOSS_CONCURRENT_PER_DEFEATS,
  BOSS_GAP_AFTER_SPAWN,
  BOSS_HP_SCALE_BASE,
  BOSS_HP_SQRT_DIVISOR,
  BOSS_MAX_CONCURRENT,
  BOSS_SUPPRESSION,
  CAP_BASE,
  CAP_LATE_FROM,
  CAP_LATE_MAX,
  CAP_LATE_STEP,
  CAP_MAX,
  CAP_STEP,
  GROUP_LATE_STEP,
  SIDE_BANDS,
  SPAWN_AIM_JITTER_DEG,
  SPAWN_BASE,
  SPAWN_BOTTOM_MIN_GAP,
  SPAWN_HALVING_SCORE,
  SPAWN_MARGIN,
  SPAWN_MIN,
  SPAWN_MIN_LATE,
  SPAWN_MIN_LATE_SCORE,
  SPAWN_MIN_PLAYER_DIST,
  FLAGS,
  OBSTACLE_BAND,
  OBSTACLE_FIRST_Y,
  OBSTACLE_GAP_MAX,
  OBSTACLE_GAP_MIN,
  OBSTACLE_GREEN_CHANCE,
  OBSTACLE_PASSAGE,
  VIEW_H,
  VIEW_W,
  WEAPON_CARRIER_WEIGHT,
  WORLD_W,
} from '../config';
import { DEG } from '../core/math';
import { Rng } from '../core/rng';
import { BOSSES } from '../data/bosses';
import type { EnemyDef } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import { OBSTACLE_KINDS, greenVariant } from '../data/obstacles';
import type { Enemy } from './entities/Enemy';
import { toughness } from './difficulty';
import { applyDef } from './entities/Enemy';
import type { World } from './World';

type Side = 0 | 1 | 2 | 3; // top, left, right, bottom

/** Obstacles keep clear of the side walls, so you can always pass along one. */
const PLAY_EDGE = 70;

/**
 * Whether a group of this type may include the weapon carrier. Not an air
 * unit, which only homing can reach - a weapon you mostly cannot get at is a
 * weapon withheld - and not something that already carries a drop.
 */
function canCarry(def: EnemyDef): boolean {
  return def.flying !== true && def.drop === 'none';
}

function countSolids(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    if (w.enemies.active[i].solid) n++;
  }
  return n;
}

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
  /** World y at which the next obstacle cluster is laid down. */
  private nextObstacleY = OBSTACLE_FIRST_Y;
  /**
   * Obstacles roll on their OWN stream. Terrain comes and goes with distance
   * rather than time, so sharing the world's stream would reshuffle every
   * enemy spawn whenever the player's pace changed by a hair.
   */
  private readonly obstacleRng = new Rng();
  /** Total spawn weight of the last roll, for the weapon-carrier odds. */
  private rolledWeight = 0;
  /**
   * A weapon carrier is due. Owed rather than rolled per group, so a roll
   * that lands on a type that cannot carry one (a helicopter, say) hands it
   * to the next group instead of losing it - which is what keeps the drop
   * rate equal to the old crate's.
   */
  private carrierOwed = false;
  /** Scratch: the members of the group being spawned. */
  private readonly group: Enemy[] = [];
  /** Scratch for cluster layout; reused so a cluster allocates nothing. */
  private readonly placed: { x: number; y: number; half: number }[] = [];

  reset(seed = 0): void {
    this.timer = SPAWN_BASE * 0.5;
    this.lastBossId = '';
    this.nextObstacleY = OBSTACLE_FIRST_Y;
    this.obstacleRng.reseed(seed ^ 0x5bd1e995);
    this.carrierOwed = false;
  }

  interval(score: number): number {
    const late = Math.min(1, score / SPAWN_MIN_LATE_SCORE);
    const floor = SPAWN_MIN - (SPAWN_MIN - SPAWN_MIN_LATE) * late;
    return Math.max(floor, SPAWN_BASE * Math.pow(0.5, score / SPAWN_HALVING_SCORE));
  }

  /** The early ramp to CAP_MAX, then a slow climb for the rest of the run. */
  cap(score: number): number {
    const early = Math.min(CAP_MAX, CAP_BASE + Math.floor(score / CAP_STEP));
    const late = Math.floor(Math.max(0, score - CAP_LATE_FROM) / CAP_LATE_STEP);
    return Math.min(CAP_LATE_MAX, early + late);
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
    if (w.phase !== 'playing') return;
    // Before the dt check: the player moves on the real clock, so the road
    // ahead must keep appearing even while the world is frozen.
    this.layObstacles(w);
    if (dt === 0) return;

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

    // Obstacles share the pool but are scenery, not pressure: they must not
    // eat into how many enemies the difficulty curve allows.
    const room = this.cap(w.score) - (w.enemies.count - countSolids(w));
    if (room <= 0) return;

    const def = this.roll(w.score, w.rng);
    if (def === null) return;

    const odds = WEAPON_CARRIER_WEIGHT / (this.rolledWeight + WEAPON_CARRIER_WEIGHT);
    if (w.rng.next() < odds) this.carrierOwed = true;

    this.spawn(w, def, room);
  }

  /** Lay down every cluster the view is about to reach. */
  private layObstacles(w: World): void {
    const ahead = w.camera.y + VIEW_H / 2 + SPAWN_MARGIN;
    while (this.nextObstacleY <= ahead) {
      this.spawnCluster(w, Math.max(this.nextObstacleY, ahead));
      this.nextObstacleY += this.obstacleRng.range(
        OBSTACLE_GAP_MIN,
        OBSTACLE_GAP_MAX,
      );
    }
  }

  /**
   * One cluster: a few blocks, or a stand of trees, scattered across the
   * whole corridor - terrain belongs to the world, not to the current view.
   *
   * Every pair keeps OBSTACLE_PASSAGE of clear space between their bodies,
   * so a cluster always has a way through and is never a wall: it is there
   * to make you steer, and the darkness behind makes a dead end lethal.
   * Sometimes one member is green and full of coins, as in the original.
   */
  private spawnCluster(w: World, baseY: number): void {
    const rng = this.obstacleRng;
    const kind = OBSTACLE_KINDS[rng.int(OBSTACLE_KINDS.length)];
    const wanted = kind[0].shape === 'tree' ? 3 + rng.int(4) : 2 + rng.int(3);
    const greenAt = rng.next() < OBSTACLE_GREEN_CHANCE ? rng.int(wanted) : -1;

    const placed = this.placed;
    placed.length = 0;
    for (let i = 0; i < wanted; i++) {
      const base = kind[rng.int(kind.length)];
      const def = i === greenAt ? greenVariant(base) : base;
      const half = def.solid === 'box' ? def.drawSize / 2 : def.hitboxRadius;

      // Rejection sampling: a handful of tries, then give up on this member
      // rather than force it into a gap.
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = rng.range(PLAY_EDGE + half, WORLD_W - PLAY_EDGE - half);
        const y = baseY + half + rng.next() * OBSTACLE_BAND;
        let clear = true;
        for (const o of placed) {
          const need = half + o.half + OBSTACLE_PASSAGE;
          if (Math.abs(x - o.x) < need && Math.abs(y - o.y) < need) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;

        const e = w.enemies.spawn();
        if (e === null) return;
        applyDef(e, def);
        e.hp = Math.ceil(def.hp * toughness(w.score));
        e.maxHp = e.hp;
        e.x = x;
        e.y = y;
        e.heading = Math.PI / 2;
        e.angle = 0;
        placed.push({ x, y, half });
        break;
      }
    }
  }

  /**
   * How many of this type arrive together. Flocking types also grow with
   * score; lone types (bears, carriers) stay lone however far you get, because
   * a wall of bears is not a difficulty curve, it is a brick wall.
   */
  private groupSize(def: EnemyDef, score: number, rng: Rng): number {
    const lo = def.groupMin ?? 1;
    const hi = def.groupMax ?? 1;
    if (hi <= 1) return 1;
    const base = lo + rng.int(hi - lo + 1);
    // Herds of big things keep their size: score grows the flocks of small
    // things, not walls of bears you cannot get through.
    if (def.herd === true) return base;
    const bonus =
      Math.min(3, Math.floor(score / 650)) +
      Math.min(3, Math.floor(score / GROUP_LATE_STEP));
    return base + bonus;
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

    e.x = w.camera.x + VIEW_W / 2 + (w.rng.next() - 0.5) * 120;
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
    this.rolledWeight = 0;
    for (const x of this.weights) this.rolledWeight += x;
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

    // Things that never move must appear AHEAD, where the player will reach
    // them. A stationary turret or mammoth placed off-screen to the side just
    // sits there unseen until it is culled - a wasted spawn, and a silent one,
    // since nothing ever goes visibly wrong. This bit the original turrets too.
    if (def.archetype === 'turret') side = 0;

    // Spawns are placed relative to the VISIBLE window, not the whole world.
    // Scattering them across the full width would strand many of them in the
    // off-screen part of the field, where they threaten nobody.
    const left = w.camera.x;
    const right = w.camera.x + VIEW_W;

    let x = 0;
    let y = 0;
    switch (side) {
      case 0:
        x = rng.range(left + 20, right - 20);
        y = top;
        break;
      case 1:
        x = Math.max(-SPAWN_MARGIN, left - SPAWN_MARGIN);
        y = rng.range(bottom + 140, top - 60);
        break;
      case 2:
        x = Math.min(WORLD_W + SPAWN_MARGIN, right + SPAWN_MARGIN);
        y = rng.range(bottom + 140, top - 60);
        break;
      case 3:
        x = rng.range(left + 20, right - 20);
        y = Math.max(bottom, w.darkness.y + 30);
        break;
    }

    // Aim inward, with jitter so formations do not look stamped out.
    const toPlayer = Math.atan2(w.player.y - y, w.player.x - x);
    const jitter = (rng.next() - 0.5) * 2 * SPAWN_AIM_JITTER_DEG * DEG;
    let heading: number;
    if (def.archetype === 'drift') {
      heading = -Math.PI / 2 + (rng.next() - 0.5) * 0.5; // carriers drift downward
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
    const group = this.group;
    group.length = 0;
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
      e.hp = Math.ceil(def.hp * toughness(w.score));
      e.maxHp = e.hp;
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
      group.push(e);
    }

    // One member turns blue and carries a weapon: the blue bird in the
    // flock. It keeps its kind's shape and movement, so it is found by
    // colour alone - exactly how the original teaches it.
    if (this.carrierOwed && canCarry(def) && group.length > 0) {
      const c = group[rng.int(group.length)];
      c.colorRole = 'blue';
      c.drop = 'weapon';
      this.carrierOwed = false;
    }
  }
}
