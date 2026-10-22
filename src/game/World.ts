import type { Clock } from '../core/clock';
import type { InputFrame } from '../core/input';
import {
  DEATH_HOLD_SEC,
  DEATH_SLOWMO,
  POOL_ESHOT,
  POOL_PSHOT,
  VIEW_W,
} from '../config';
import { Pool } from '../core/pool';
import { Camera } from './Camera';
import { Darkness } from './Darkness';
import type { Player } from './entities/Player';
import { createPlayer } from './entities/Player';
import type { Projectile } from './entities/Projectile';
import { createProjectile, resetProjectile } from './entities/Projectile';
import {
  tickInvincibility,
  updatePlayerBody,
  updatePlayerGuns,
} from './systems/playerSystem';
import { updateProjectiles } from './systems/projectileSystem';

export type Phase = 'playing' | 'dying' | 'dead';

export type DeathCause = 'darkness' | 'contact' | null;

/**
 * Owns every pool and the system ordering.
 *
 * `update()` below is the most important function in the codebase. It is kept
 * flat and explicitly grouped by clock on purpose: the correctness of the whole
 * game is "did this system get the right dt", and that should be readable at a
 * glance rather than buried in a system graph.
 */
export class World {
  readonly player: Player = createPlayer();
  readonly playerShots: Pool<Projectile>;
  readonly enemyShots: Pool<Projectile>;
  readonly camera = new Camera();
  readonly darkness = new Darkness();

  score = 0;
  coins = 0;
  phase: Phase = 'playing';
  deathCause: DeathCause = null;
  /** REAL seconds of slow-motion hold after dying. */
  deathHold = 0;

  constructor() {
    this.playerShots = new Pool<Projectile>(
      POOL_PSHOT,
      createProjectile,
      resetProjectile,
    );
    this.enemyShots = new Pool<Projectile>(
      POOL_ESHOT,
      createProjectile,
      resetProjectile,
    );
    this.reset();
  }

  reset(): void {
    const p = this.player;
    p.x = VIEW_W / 2;
    p.y = 0;
    p.alive = true;
    p.invulnRealFor = 0;
    p.fireCooldown = 0;
    p.speed = 0;

    this.playerShots.clear();
    this.enemyShots.clear();
    this.playerShots.resetStats();
    this.enemyShots.resetStats();

    this.camera.reset(p.y);
    this.darkness.reset(p.y);

    this.score = 0;
    this.coins = 0;
    this.phase = 'playing';
    this.deathCause = null;
    this.deathHold = 0;
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
    // Only these may read clock.real. The type system enforces it: passing
    // clock.scaled to any of them is a compile error.
    updatePlayerBody(this.player, input, R);
    tickInvincibility(this.player, R);
    this.darkness.update(this.player.y, this.score, R);
    this.camera.follow(this.player.y, this.darkness.y, R);

    // =================================================== SCALED CLOCK
    // Everything else. At timeScale 0 these are all no-ops, which is the
    // freeze - achieved with no special-casing anywhere.
    updatePlayerGuns(this, S);
    updateProjectiles(this.playerShots, this.camera.y, S);
    updateProjectiles(this.enemyShots, this.camera.y, S);
    // step 9:  updateEnemies(this, S)
    // step 10: resolveCollisions(this); resolveDamage(this)
    // step 11: updatePickups(this, S)
    // step 12: this.spawnDirector.update(this, S)

    // ============================= ORDER-SENSITIVE, CLOCK-FREE
    this.checkDarknessKill();
    this.tickDeathHold(R);

    // One swap-remove sweep per pool per frame. Systems only set alive=false.
    this.playerShots.compact();
    this.enemyShots.compact();
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
