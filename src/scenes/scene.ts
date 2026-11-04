import type { ClockSource } from '../core/clock';
import type { Input } from '../core/input';
import type { Rng } from '../core/rng';
import type { TimeScaleController } from '../core/timeScale';
import type { MetaState } from '../game/MetaState';
import type { World } from '../game/World';
import type { Viewport } from '../render/viewport';
import type { WeaponId } from '../game/weapons/types';

export type SceneId = 'lobby' | 'game' | 'result';

/**
 * Services every scene gets. Built once in main and injected, rather than
 * reached for as module globals - which is what lets the simulation be driven
 * headlessly in tests with a stub renderer.
 */
export interface SceneCtx {
  readonly vp: Viewport;
  readonly input: Input;
  readonly clock: ClockSource;
  readonly tsc: TimeScaleController;
  readonly meta: MetaState;
  readonly world: World;
  readonly rng: Rng;
  /** Weapons bought in the lobby, applied when the run starts. */
  pending: WeaponId[];
  /**
   * Set by the lobby when the player walks over the start line: the run
   * picks up exactly there, camera and all, so crossing is seamless. Null
   * otherwise (RUN AGAIN), and the run starts on the line.
   */
  startAt: { x: number; y: number; camX: number; camY: number } | null;
  go(id: SceneId): void;
}

export interface Scene {
  readonly id: SceneId;
  enter(ctx: SceneCtx): void;
  exit?(ctx: SceneCtx): void;
  /** Real seconds. Scenes decide for themselves what to scale. */
  update(ctx: SceneCtx, realDt: number): void;
  render(ctx: SceneCtx): void;
}

/**
 * Transitions are queued and applied between frames, so a scene can never be
 * swapped out in the middle of its own update.
 */
export class SceneManager {
  private current: Scene;
  private queued: SceneId | null = null;
  private readonly scenes: Record<SceneId, Scene>;
  private readonly ctx: SceneCtx;

  constructor(scenes: Record<SceneId, Scene>, ctx: SceneCtx, start: SceneId) {
    this.scenes = scenes;
    this.ctx = ctx;
    this.current = scenes[start];
    this.current.enter(ctx);
  }

  get id(): SceneId {
    return this.current.id;
  }

  request(id: SceneId): void {
    this.queued = id;
  }

  frame(realDt: number): void {
    this.current.update(this.ctx, realDt);
    this.current.render(this.ctx);

    if (this.queued !== null) {
      const next = this.scenes[this.queued];
      this.queued = null;
      this.current.exit?.(this.ctx);
      this.current = next;
      this.current.enter(this.ctx);
    }
  }
}
