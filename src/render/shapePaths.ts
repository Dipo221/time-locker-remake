import type { FillRole, ShapeDef, ShapeId, ShapePart } from '../data/shapes';
import { SHAPES } from '../data/shapes';

/**
 * Compiles each ShapeDef to cached Path2D objects ONCE, at unit scale.
 *
 * Drawing is then save / translate / rotate / scale / fill(path) / restore.
 * Path2D plus a transform is dramatically faster than re-issuing moveTo/lineTo
 * per entity, and consecutive parts sharing a fill role are merged into one
 * path so fillStyle changes a handful of times per shape rather than per part.
 */
export interface CompiledLayer {
  role: FillRole;
  path: Path2D;
}

export interface CompiledShape {
  layers: readonly CompiledLayer[];
}

function addPart(path: Path2D, part: ShapePart, mirror: boolean): void {
  const sx = mirror ? -1 : 1;
  switch (part.kind) {
    case 'poly': {
      const p = part.points;
      if (p.length < 6) return;
      path.moveTo(sx * p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) path.lineTo(sx * p[i], p[i + 1]);
      path.closePath();
      return;
    }
    case 'circle': {
      const cx = sx * part.x;
      path.moveTo(cx + part.r, part.y);
      path.arc(cx, part.y, part.r, 0, Math.PI * 2);
      return;
    }
    case 'rect': {
      // Mirroring a rect means reflecting its far edge, not just its origin.
      const x = mirror ? -(part.x + part.w) : part.x;
      path.rect(x, part.y, part.w, part.h);
      return;
    }
    case 'mirror':
      addPart(path, part.of, !mirror);
      return;
  }
}

function compile(def: ShapeDef): CompiledShape {
  const layers: CompiledLayer[] = [];
  let current: CompiledLayer | null = null;

  for (const part of def.parts) {
    // A mirror inherits the fill role of the part it mirrors.
    const role: FillRole = part.kind === 'mirror' ? roleOf(part.of) : part.fill;
    if (current === null || current.role !== role) {
      current = { role, path: new Path2D() };
      layers.push(current);
    }
    addPart(current.path, part, false);
  }
  return { layers };
}

function roleOf(part: ShapePart): FillRole {
  return part.kind === 'mirror' ? roleOf(part.of) : part.fill;
}

const cache = new Map<ShapeId, CompiledShape>();

export function getShape(id: ShapeId): CompiledShape {
  let c = cache.get(id);
  if (c === undefined) {
    c = compile(SHAPES[id]);
    cache.set(id, c);
  }
  return c;
}

/** Warm every shape up front so no frame pays a first-use compile cost. */
export function precompileShapes(): void {
  for (const id of Object.keys(SHAPES) as ShapeId[]) getShape(id);
}
