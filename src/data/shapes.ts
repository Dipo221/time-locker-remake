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
  | 'bulletRound'
  | 'bulletLong';

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

  /**
   * Enemy fire: radially symmetric, so it reads as "incoming from anywhere".
   */
  bulletRound: {
    parts: [{ kind: 'circle', x: 0, y: 0, r: 0.5, fill: 'body' }],
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
