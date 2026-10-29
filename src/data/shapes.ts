/**
 * Procedural silhouettes. No image assets anywhere in this project.
 *
 * Shapes are authored in a normalised box roughly -0.5..0.5 on both axes, with
 * +Y pointing FORWARD (the direction the creature faces / travels). The draw
 * layer scales by the entity's drawSize and rotates by its heading.
 *
 * Colour is NOT stored here. Parts carry a `fill` ROLE which is resolved at
 * draw time against the entity's palette, so one `penguin` shape serves the
 * black, orange and purple variants. That is the data-entry multiplier that
 * makes a 30-enemy roster tractable.
 */

export type FillRole = 'body' | 'accent' | 'ink';

export type ShapePart =
  | { kind: 'poly'; points: readonly number[]; fill: FillRole }
  | { kind: 'circle'; x: number; y: number; r: number; fill: FillRole }
  | {
      kind: 'rect';
      x: number;
      y: number;
      w: number;
      h: number;
      fill: FillRole;
    }
  /** Mirrors another part across x=0. Halves authoring for symmetric animals. */
  | { kind: 'mirror'; of: ShapePart };

export interface ShapeDef {
  readonly parts: readonly ShapePart[];
}

export type ShapeId =
  | 'locker'
  | 'penguin'
  | 'dog'
  | 'bird'
  | 'bear'
  | 'block'
  | 'coin'
  | 'mammoth'
  | 'gorilla'
  | 'dino'
  | 'insect'
  | 'lion'
  | 'car'
  | 'frog'
  | 'heli'
  | 'mine'
  | 'bit'
  | 'supporter'
  | 'bulletRound'
  | 'bulletLong'
  | 'beam';

/** Convenience: a part and its mirror image. */
function sym(p: ShapePart): ShapePart[] {
  return [p, { kind: 'mirror', of: p }];
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  /**
   * THE LOCKER - the starting character. Small, blocky, unremarkable on
   * purpose: its identity is the smallest hitbox in the game, not its guns.
   */
  locker: {
    parts: [
      { kind: 'rect', x: -0.26, y: -0.34, w: 0.52, h: 0.46, fill: 'body' },
      ...sym({ kind: 'rect', x: 0.1, y: 0.1, w: 0.12, h: 0.16, fill: 'body' }),
      { kind: 'circle', x: 0, y: 0.22, r: 0.2, fill: 'body' },
      ...sym({ kind: 'circle', x: 0.15, y: 0.37, r: 0.085, fill: 'body' }),
      { kind: 'rect', x: -0.07, y: 0.3, w: 0.14, h: 0.12, fill: 'accent' },
    ],
  },

  penguin: {
    parts: [
      { kind: 'circle', x: 0, y: -0.04, r: 0.26, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.24, r: 0.17, fill: 'body' },
      ...sym({
        kind: 'poly',
        points: [0.2, 0.06, 0.4, -0.08, 0.22, -0.2],
        fill: 'body',
      }),
      { kind: 'poly', points: [-0.06, 0.34, 0.06, 0.34, 0, 0.46], fill: 'accent' },
    ],
  },

  dog: {
    parts: [
      { kind: 'rect', x: -0.2, y: -0.36, w: 0.4, h: 0.52, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.24, r: 0.18, fill: 'body' },
      ...sym({
        kind: 'poly',
        points: [0.1, 0.36, 0.22, 0.48, 0.05, 0.4],
        fill: 'body',
      }),
      ...sym({ kind: 'rect', x: 0.14, y: -0.4, w: 0.1, h: 0.14, fill: 'body' }),
      { kind: 'poly', points: [-0.05, 0.38, 0.05, 0.38, 0, 0.5], fill: 'accent' },
    ],
  },

  bird: {
    parts: [
      { kind: 'poly', points: [0, 0.4, 0.12, -0.1, 0, -0.34, -0.12, -0.1], fill: 'body' },
      ...sym({
        kind: 'poly',
        points: [0.08, 0.12, 0.46, -0.06, 0.1, -0.16],
        fill: 'body',
      }),
    ],
  },

  bear: {
    parts: [
      { kind: 'circle', x: 0, y: -0.08, r: 0.3, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.22, r: 0.21, fill: 'body' },
      ...sym({ kind: 'circle', x: 0.17, y: 0.38, r: 0.095, fill: 'body' }),
      ...sym({ kind: 'circle', x: 0.26, y: -0.24, r: 0.1, fill: 'body' }),
      { kind: 'circle', x: 0, y: 0.3, r: 0.07, fill: 'accent' },
    ],
  },

  /** The blue "?" crate that carries a weapon. */
  block: {
    parts: [
      { kind: 'rect', x: -0.4, y: -0.4, w: 0.8, h: 0.8, fill: 'body' },
      { kind: 'rect', x: -0.26, y: -0.26, w: 0.52, h: 0.52, fill: 'accent' },
    ],
  },

  coin: {
    parts: [
      { kind: 'circle', x: 0, y: 0, r: 0.4, fill: 'body' },
      { kind: 'circle', x: 0, y: 0, r: 0.22, fill: 'accent' },
    ],
  },

  // --- bosses -----------------------------------------------------------
  // Drawn large, so these carry more detail than the rank-and-file. Each
  // needs a distinct silhouette at a glance: a player who has to squint at a
  // boss to know which one it is cannot plan against it.

  /** Mammoth: the orthodox boss. Bulk, tusks, trunk. */
  mammoth: {
    parts: [
      { kind: 'circle', x: 0, y: -0.1, r: 0.33, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.2, r: 0.25, fill: 'body' },
      ...sym({ kind: 'circle', x: 0.26, y: 0.3, r: 0.11, fill: 'body' }),
      { kind: 'rect', x: -0.07, y: 0.26, w: 0.14, h: 0.28, fill: 'body' },
      ...sym({
        kind: 'poly',
        points: [0.14, 0.34, 0.33, 0.5, 0.36, 0.38, 0.2, 0.26],
        fill: 'accent',
      }),
      ...sym({ kind: 'rect', x: 0.12, y: -0.46, w: 0.11, h: 0.18, fill: 'body' }),
    ],
  },

  /** Gorilla: faster than you. Broad shoulders, long arms. */
  gorilla: {
    parts: [
      { kind: 'circle', x: 0, y: -0.06, r: 0.3, fill: 'body' },
      ...sym({ kind: 'circle', x: 0.3, y: 0.06, r: 0.15, fill: 'body' }),
      ...sym({
        kind: 'poly',
        points: [0.26, 0.14, 0.44, -0.16, 0.3, -0.3, 0.18, -0.08],
        fill: 'body',
      }),
      { kind: 'circle', x: 0, y: 0.26, r: 0.19, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.3, r: 0.1, fill: 'accent' },
    ],
  },

  /** Dinosaur: the most durable, and big enough to block the view. */
  dino: {
    parts: [
      {
        kind: 'poly',
        points: [0, -0.5, 0.1, -0.2, 0.22, 0.04, 0.1, 0.24, -0.1, 0.24, -0.22, 0.04, -0.1, -0.2],
        fill: 'body',
      },
      { kind: 'circle', x: 0, y: 0.3, r: 0.17, fill: 'body' },
      {
        kind: 'poly',
        points: [-0.14, 0.34, 0.14, 0.34, 0.1, 0.5, -0.1, 0.5],
        fill: 'accent',
      },
      ...sym({
        kind: 'poly',
        points: [0.2, 0.0, 0.42, -0.1, 0.22, -0.18],
        fill: 'body',
      }),
      ...sym({ kind: 'rect', x: 0.08, y: -0.44, w: 0.1, h: 0.16, fill: 'body' }),
    ],
  },

  /** Insect: pauses, then closes fast. Segmented, many legs. */
  insect: {
    parts: [
      { kind: 'circle', x: 0, y: -0.22, r: 0.19, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.02, r: 0.22, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.26, r: 0.16, fill: 'body' },
      ...sym({ kind: 'rect', x: 0.16, y: 0.1, w: 0.3, h: 0.055, fill: 'body' }),
      ...sym({ kind: 'rect', x: 0.16, y: -0.08, w: 0.28, h: 0.055, fill: 'body' }),
      ...sym({ kind: 'rect', x: 0.14, y: -0.26, w: 0.24, h: 0.055, fill: 'body' }),
      ...sym({
        kind: 'poly',
        points: [0.06, 0.36, 0.2, 0.5, 0.1, 0.34],
        fill: 'accent',
      }),
    ],
  },

  /**
   * Enemy fire: radially symmetric, so it reads as "incoming from anywhere".
   */
  bulletRound: {
    parts: [{ kind: 'circle', x: 0, y: 0, r: 0.5, fill: 'body' }],
  },

  /** Lion: the mane is the silhouette. */
  lion: {
    parts: [
      { kind: 'rect', x: -0.2, y: -0.4, w: 0.4, h: 0.46, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.18, r: 0.3, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.24, r: 0.15, fill: 'accent' },
      ...sym({ kind: 'rect', x: 0.12, y: -0.44, w: 0.1, h: 0.14, fill: 'body' }),
    ],
  },

  /** Car: a box on four wheels, seen from above. */
  car: {
    parts: [
      { kind: 'rect', x: -0.28, y: -0.46, w: 0.56, h: 0.92, fill: 'body' },
      { kind: 'rect', x: -0.18, y: 0.08, w: 0.36, h: 0.22, fill: 'accent' },
      ...sym({ kind: 'rect', x: 0.26, y: 0.18, w: 0.12, h: 0.2, fill: 'body' }),
      ...sym({ kind: 'rect', x: 0.26, y: -0.36, w: 0.12, h: 0.2, fill: 'body' }),
    ],
  },

  /** Frog: wide and flat, legs folded ready to spring. */
  frog: {
    parts: [
      { kind: 'circle', x: 0, y: 0, r: 0.3, fill: 'body' },
      ...sym({ kind: 'circle', x: 0.16, y: 0.26, r: 0.1, fill: 'body' }),
      ...sym({
        kind: 'poly',
        points: [0.22, -0.06, 0.48, -0.3, 0.3, -0.36, 0.16, -0.2],
        fill: 'body',
      }),
      ...sym({ kind: 'circle', x: 0.16, y: 0.28, r: 0.045, fill: 'accent' }),
    ],
  },

  /**
   * Helicopter: body plus a rotor cross. Drawn with a shadow underneath in
   * play, since being airborne is the whole rule - only homing weapons reach
   * it, and touching it is harmless.
   */
  heli: {
    parts: [
      { kind: 'circle', x: 0, y: 0.06, r: 0.22, fill: 'body' },
      { kind: 'rect', x: -0.05, y: -0.46, w: 0.1, h: 0.36, fill: 'body' },
      { kind: 'rect', x: -0.5, y: 0.02, w: 1.0, h: 0.07, fill: 'body' },
      { kind: 'rect', x: -0.035, y: -0.44, w: 0.07, h: 1.0, fill: 'body' },
      { kind: 'circle', x: 0, y: 0.12, r: 0.09, fill: 'accent' },
    ],
  },

  /** MINE BOT: a spiked puck. */
  mine: {
    parts: [
      { kind: 'circle', x: 0, y: 0, r: 0.32, fill: 'body' },
      ...sym({ kind: 'rect', x: 0.28, y: -0.06, w: 0.2, h: 0.12, fill: 'body' }),
      { kind: 'rect', x: -0.06, y: 0.28, w: 0.12, h: 0.2, fill: 'body' },
      { kind: 'rect', x: -0.06, y: -0.48, w: 0.12, h: 0.2, fill: 'body' },
      { kind: 'circle', x: 0, y: 0, r: 0.14, fill: 'accent' },
    ],
  },

  /** GUARD BIT: a hard little square. */
  bit: {
    parts: [
      { kind: 'rect', x: -0.42, y: -0.42, w: 0.84, h: 0.84, fill: 'body' },
      { kind: 'rect', x: -0.18, y: -0.18, w: 0.36, h: 0.36, fill: 'accent' },
    ],
  },

  /** SUPPORTER: an arrowhead, because it eventually flies off as one. */
  supporter: {
    parts: [
      { kind: 'poly', points: [0, 0.5, 0.34, -0.3, 0, -0.1, -0.34, -0.3], fill: 'body' },
    ],
  },

  /** A piercing lance: long and thin, so its travel line is unmistakable. */
  beam: {
    parts: [
      { kind: 'rect', x: -0.11, y: -1.5, w: 0.22, h: 3.0, fill: 'body' },
      { kind: 'rect', x: -0.05, y: -1.5, w: 0.1, h: 3.0, fill: 'accent' },
    ],
  },

  /**
   * Player fire: elongated along travel, so it reads as "going somewhere".
   * The shape difference is one of four independent differentiators between
   * player and enemy bullets - see drawWorld.
   */
  bulletLong: {
    parts: [
      { kind: 'poly', points: [0, 0.5, 0.26, 0, 0, -0.5, -0.26, 0], fill: 'body' },
    ],
  },
};
