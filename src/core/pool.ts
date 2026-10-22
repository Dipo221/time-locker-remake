/**
 * Fixed-capacity object pool with a dense active array and swap-remove.
 *
 * Objects are allocated once up front and never freed, so the hot loop produces
 * zero garbage. High weapon stacking spawns hundreds of projectiles and
 * particles per second, and a GC pause is a visible hitch.
 *
 * Two disciplines make array-of-objects fast, and both are easy to break:
 *
 * 1. The factory initialises EVERY field, in a fixed order. Never add a field
 *    later, never `delete`, never assign undefined to a numeric field. This
 *    keeps every object in the pool on one hidden class.
 *
 * 2. Cross-frame references use generational handles. Pooled objects get
 *    recycled, so a homing missile holding a raw Enemy reference will happily
 *    chase a recycled, respawned enemy. `gen` is bumped on release; holders
 *    store {ref, gen} and validate before use. This single rule prevents the
 *    most confusing bug class in pooled arcade games.
 */
export interface Poolable {
  alive: boolean;
  /** Bumped on release. Validate against a stored gen before using a ref. */
  gen: number;
}

export class Pool<T extends Poolable> {
  /** Live items are always active[0 .. count-1], densely packed. */
  readonly active: T[];
  count = 0;
  /** Spawn requests refused because the pool was full. Any value > 0 is a bug. */
  misses = 0;
  /** Peak `count` observed. Use this to size pools for shipping (~1.3x). */
  highWater = 0;

  private readonly reset: (t: T) => void;

  constructor(capacity: number, factory: () => T, reset: (t: T) => void) {
    this.active = new Array<T>(capacity);
    for (let i = 0; i < capacity; i++) this.active[i] = factory();
    this.reset = reset;
  }

  get capacity(): number {
    return this.active.length;
  }

  /**
   * Claim the next free slot, reset it, and mark it alive. Returns null when
   * full. The returned object is recycled, never freshly allocated.
   */
  spawn(): T | null {
    if (this.count >= this.active.length) {
      this.misses++;
      return null;
    }
    const t = this.active[this.count++];
    this.reset(t);
    t.alive = true;
    if (this.count > this.highWater) this.highWater = this.count;
    return t;
  }

  /**
   * Single swap-remove sweep over the active array. Call once per pool per
   * frame; systems only ever set `alive = false` and never splice.
   */
  compact(): void {
    let i = 0;
    while (i < this.count) {
      const t = this.active[i];
      if (t.alive) {
        i++;
        continue;
      }
      t.gen++;
      const last = this.count - 1;
      if (i !== last) {
        this.active[i] = this.active[last];
        this.active[last] = t;
      }
      this.count--;
      // do not advance i: a new item now occupies this slot
    }
  }

  /** Kill everything. Bumps generations so stale handles cannot resolve. */
  clear(): void {
    for (let i = 0; i < this.count; i++) {
      const t = this.active[i];
      t.alive = false;
      t.gen++;
    }
    this.count = 0;
  }

  resetStats(): void {
    this.misses = 0;
    this.highWater = this.count;
  }
}

/** A reference that survives pool recycling. Validate with `deref`. */
export interface Handle<T extends Poolable> {
  ref: T | null;
  gen: number;
}

export function setHandle<T extends Poolable>(h: Handle<T>, t: T | null): void {
  h.ref = t;
  h.gen = t ? t.gen : -1;
}

export function deref<T extends Poolable>(h: Handle<T>): T | null {
  const t = h.ref;
  if (t === null || !t.alive || t.gen !== h.gen) return null;
  return t;
}
