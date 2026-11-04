import { COLOR, SHOT_COLORS } from '../config';
import { weaponFamily } from '../game/weapons/compile';
import type { WeaponId } from '../game/weapons/types';
import { roundRect } from './ui';
import { drawWeaponIcon } from './weaponIcon';

/**
 * The loadout as the original shows it on its pause and result screens: a
 * two-column grid of dark tiles, each an icon and a stack count. The left
 * edge carries the shot colour, as the in-run chips do, so the two read as
 * one legend.
 */
export const TILE_W = 112;
export const TILE_H = 44;
export const TILE_GAP = 8;
/** Both columns and the gap between them. */
export const TILES_W = TILE_W * 2 + TILE_GAP;

/** Height of the grid for `n` weapons. */
export function tilesHeight(n: number): number {
  const rows = Math.ceil(n / 2);
  return rows === 0 ? 0 : rows * TILE_H + (rows - 1) * TILE_GAP;
}

/** UI space, top-left of the grid at (x, y). */
export function drawWeaponTiles(
  c: CanvasRenderingContext2D,
  stacks: readonly (readonly [WeaponId, number])[],
  x: number,
  y: number,
): void {
  for (let i = 0; i < stacks.length; i++) {
    const [id, n] = stacks[i];
    const tx = x + (i % 2) * (TILE_W + TILE_GAP);
    const ty = y + Math.floor(i / 2) * (TILE_H + TILE_GAP);

    c.fillStyle = COLOR.ink;
    roundRect(c, tx, ty, TILE_W, TILE_H, 8);
    c.fill();
    c.fillStyle = SHOT_COLORS[weaponFamily(id)].body;
    roundRect(c, tx, ty, 6, TILE_H, 3);
    c.fill();

    drawWeaponIcon(c, id, tx + 36, ty + TILE_H / 2, 34, '#ffffff', COLOR.ink);

    c.font = 'italic 900 28px ui-sans-serif, system-ui, sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillText(String(n), tx + TILE_W - 12, ty + TILE_H / 2 + 1);
  }
}
