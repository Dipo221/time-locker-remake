import type { Clock } from '../core/clock';
import type { InputFrame } from '../core/input';
import {
  BOSS_GAP_BASE,
  BOSS_GAP_MAX,
  BOSS_GAP_SLOPE,
  DEATH_HOLD_SEC,
  DEATH_SLOWMO,
  SCORE_FIRST_BOSS,
  POOL_ENEMY,
  POOL_ESHOT,
  POOL_PARTICLE,
  POOL_DRONE,
  POOL_PICKUP,
  POOL_PSHOT,
  WORLD_W,
} from '../config';
import { Pool } from '../core/pool';
import { Rng } from '../core/rng';
import { CHARACTERS, DEFAULT_CHARACTER } from '../data/characters';
import { DRONES, DRONE_IDS } from '../data/drones';
import { PROJECTILE_WEAPON_IDS, WEAPONS } from '../data/weapons';
import { Camera } from './Camera';
import { Darkness } from './Darkness';
import { SpawnDirector } from './SpawnDirector';
import type { Drone } from './entities/Drone';
import { createDrone, resetDrone } from './entities/Drone';
import type { Enemy } from './entities/Enemy';
import { createEnemy, resetEnemy } from './entities/Enemy';
import type { Particle } from './entities/Particle';
import { createParticle, resetParticle } from './entities/Particle';
import type { Pickup } from './entities/Pickup';
import { createPickup, resetPickup } from './entities/Pickup';
import type { Player } from './entities/Player';
import { createPlayer } from './entities/Player';
import type { Projectile } from './entities/Projectile';
import { createProjectile, resetProjectile } from './entities/Projectile';
import { resolveCollisions } from './systems/collisionSystem';
import { updateEnemies } from './systems/enemySystem';
import { updateEnemyGuns } from './systems/enemyWeaponSystem';
import { DroneController } from './systems/droneSystem';
import { updateParticles } from './systems/particleSystem';
import { updatePickups } from './systems/pickupSystem';
import { tickInvincibility, updatePlayerBody } from './systems/playerSystem';
import { updateProjectiles } from './systems/projectileSystem';
import { updatePlayerGuns } from './systems/weaponSystem';
import { compileLoadout } from './weapons/compile';
import type { CharacterDef, CompiledLoadout, WeaponId } from './weapons/types';

export type Phase = 'playing' | 'dying' | 'dead';
export type DeathCause = 'darkness' | 'contact' | null;

/**
 * Owns every pool and the system ordering.
 *
 * `update()` is the most important function in the codebase. It is kept flat
 * and explicitly grouped by clock on purpose: the correctness of the whole game
 * reduces to "did this system get the right dt", and that should be readable at
 * a glance rather than buried in a system graph.
 */
export class World {
  readonly player: Player = createPlayer();
  readonly playerShots: Pool<Projectile>;
  readonly enemyShots: Pool<Projectile>;
  readonly enemies: Pool<Enemy>;
  readonly particles: Pool<Particle>;
  readonly pickups: Pool<Pickup>;
  readonly drones: Pool<Drone>;

  readonly camera = new Camera();
  readonly darkness = new Darkness();
  readonly spawner = new SpawnDirector();
  readonly droneCtl = new DroneController();
  readonly rng = new Rng();

  character: CharacterDef = CHARACTERS[DEFAULT_CHARACTER];
  /** The run's loadout as a multiset. Stacking is unbounded. */
  readonly stacks = new Map<WeaponId, number>();
  loadout: CompiledLoadout;

  score = 0;
  coins = 0;
  /** How many bosses have been spawned this run. */
  bossesSpawned = 0;
  /** How many have actually been beaten. Drives spacing and concurrency. */
  bossesDefeated = 0;
  /**
   * Score at which the next boss becomes due. Stored rather than computed,
   * because it is measured forward from the last boss's DEATH - an absolute
   * schedule puts bosses back to back once score accrues quickly.
   */
  nextBossScore = SCORE_FIRST_BOSS;
  phase: Phase = 'playing';
  deathCause: DeathCause = null;
  /** REAL seconds of slow-motion hold after dying. */
  deathHold = 0;

  /** Every droppable weapon, projectile and drone alike, with its rarity. */
  private readonly dropIds: WeaponId[] = [
    ...PROJECTILE_WEAPON_IDS,
    ...DRONE_IDS,
  ];
  private readonly dropWeights: number[] = [
    ...PROJECTILE_WEAPON_IDS.map((id) => WEAPONS[id].pickupWeight),
    ...DRONE_IDS.map((id) => DRONES[id].pickupWeight),
  ];

  constructor(characterId: string = DEFAULT_CHARACTER) {
    this.playerShots = new Pool(POOL_PSHOT, createProjectile, resetProjectile);
    this.enemyShots = new Pool(POOL_ESHOT, createProjectile, resetProjectile);
    this.enemies = new Pool(POOL_ENEMY, createEnemy, resetEnemy);
    this.particles = new Pool(POOL_PARTICLE, createParticle, resetParticle);
    this.pickups = new Pool(POOL_PICKUP, createPickup, resetPickup);
    this.drones = new Pool(POOL_DRONE, createDrone, resetDrone);

    this.character = CHARACTERS[characterId] ?? CHARACTERS[DEFAULT_CHARACTER];
    this.loadout = compileLoadout(this.character, this.stacks);
    this.reset();
  }

  setCharacter(id: string): void {
    const c = CHARACTERS[id];
    if (c === undefined) return;
    this.character = c;
    this.reset();
  }

  reset(seed = (Math.random() * 0xffffffff) >>> 0): void {
    this.rng.reseed(seed);

    const p = this.player;
    p.x = WORLD_W / 2;
    p.y = 0;
    p.alive = true;
    p.invulnRealFor = 0;
    p.fireCooldown = 0;
    p.speed = 0;
    p.stepDist = 0;
    p.shape = this.character.shape;
    p.drawSize = this.character.drawSize;
    p.hitboxRadius = this.character.hitboxRadius;
    p.dragGain = this.character.dragGain;

    // Listed explicitly rather than looped: Pool<T> is invariant in T because
    // of its reset callback, so a widened array would need an unsound cast.
    this.playerShots.clear();
    this.enemyShots.clear();
    this.enemies.clear();
    this.particles.clear();
    this.pickups.clear();
    this.drones.clear();
    this.droneCtl.reset();
    this.playerShots.resetStats();
    this.enemyShots.resetStats();
    this.enemies.resetStats();
    this.particles.resetStats();
    this.pickups.resetStats();
    this.drones.resetStats();

    this.camera.reset(p.x, p.y);
    this.darkness.reset(p.y);
    this.spawner.reset();

    this.stacks.clear();
    this.recompile();

    this.score = 0;
    this.coins = 0;
    this.bossesSpawned = 0;
    this.bossesDefeated = 0;
    this.nextBossScore = SCORE_FIRST_BOSS;
    this.phase = 'playing';
    this.deathCause = null;
    this.deathHold = 0;
  }

  /** Recompiled only when the loadout changes - never per frame. */
  private recompile(): void {
    this.loadout = compileLoadout(this.character, this.stacks);
  }

  addWeapon(id: WeaponId): void {
    this.stacks.set(id, (this.stacks.get(id) ?? 0) + 1);
    this.recompile();
  }

  rollWeapon(): WeaponId {
    const i = this.rng.weighted(this.dropWeights);
    return this.dropIds[i < 0 ? 0 : i];
  }

  /** Score the player must reach before the next boss, from here. */
  bossGap(): number {
    return Math.min(BOSS_GAP_MAX, BOSS_GAP_BASE + this.score * BOSS_GAP_SLOPE);
  }

  /** Called when a boss is killed; sets the breathing room before the next. */
  onBossDefeated(): void {
    this.bossesDefeated++;
    this.nextBossScore = this.score + this.bossGap();
  }

  countBosses(): number {
    const pool = this.enemies;
    let n = 0;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (e.alive && e.isBoss) n++;
    }
    return n;
  }

  /**
   * The live boss, if any. Scanning is fine: the enemy pool is at most a few
   * dozen entries and this runs once per frame.
   */
  bossAlive(): Enemy | null {
    const pool = this.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.active[i];
      if (e.alive && e.isBoss) return e;
    }
    return null;
  }

  /**
   * The time scale the world wants, overriding pointer-derived scale.
   * Null means "use the player's input". Only the death hold overrides.
   */
  timeScaleOverride(): number | null {
    return this.phase === 'dying' ? DEATH_SLOWMO : null;
  }

  update(clock: Clock, input: InputFrame): void {
    const R = clock.real;
    const S = clock.scaled;

    // ===================================================== REAL CLOCK
    // Only these may read clock.real. The branded types enforce it: passing
    // clock.scaled to any of them is a compile error.
    updatePlayerBody(this.player, input, R);
    tickInvincibility(this.player, R);
    this.darkness.update(this.player.y, this.score, R);
    this.camera.follow(this.player.y, this.darkness.y, R);
    this.camera.followX(this.player.x, R);

    // =================================================== SCALED CLOCK
    // Everything else. At timeScale 0 these are all no-ops, which IS the
    // freeze - achieved with no special-casing anywhere.
    this.spawner.update(this, S);
    updateEnemies(
      this.enemies,
      this.player,
      this.darkness.y,
      this.camera.x,
      this.camera.y,
      this.rng,
      S,
    );
    updateEnemyGuns(this, S);
    updatePlayerGuns(this, S);
    updateProjectiles(this.playerShots, this.camera.y, S, this);
    updateProjectiles(this.enemyShots, this.camera.y, S, this);
    this.droneCtl.update(this, S);
    updatePickups(this.pickups, this.player, this.darkness.y, S);
    updateParticles(this.particles, S);

    // ============================= ORDER-SENSITIVE, CLOCK-FREE
    // Positions are final here, so collision needs no dt at all.
    resolveCollisions(this);
    this.checkDarknessKill();
    this.tickDeathHold(R);

    // One swap-remove sweep per pool per frame. Systems only set alive=false.
    this.playerShots.compact();
    this.enemyShots.compact();
    this.enemies.compact();
    this.particles.compact();
    this.pickups.compact();
    this.drones.compact();
  }

  private checkDarknessKill(): void {
    if (this.phase !== 'playing') return;
    if (this.player.invulnRealFor > 0) return;
    if (this.darkness.swallows(this.player.y)) this.kill('darkness');
  }

  kill(cause: DeathCause): void {
    if (this.phase !== 'playing') return;
    this.phase = 'dying';
    this.deathCause = cause;
    this.deathHold = DEATH_HOLD_SEC;
    this.player.alive = false;
  }

  private tickDeathHold(dt: number): void {
    if (this.phase !== 'dying') return;
    this.deathHold -= dt;
    if (this.deathHold <= 0) {
      this.deathHold = 0;
      this.phase = 'dead';
    }
  }
}
