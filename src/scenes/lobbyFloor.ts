import {
  COLOR,
  POD_PERMANENT_COST,
  POD_PULL_COST,
  POD_UNLOCK_SCORES,
  VIEW_H,
  WEAPON_MACHINE_COST,
  WORLD_W,
} from '../config';
import { CHARACTERS, CHARACTER_IDS, MAX_POD } from '../data/characters';
import type { MetaState } from '../game/MetaState';
import { drawShape } from '../render/drawWorld';
import { roundRect } from '../render/ui';

/**
 * The lobby is the first stretch of the corridor, laid out after the
 * original's: you walk about in it as the character you will play, walk
 * into another character to become it, lean on a machine to buy from it,
 * and walk over the START line to begin - the run picks up where you stand.
 *
 * It lives in the run's own world space (y up), with the line at y = 0 where
 * every run starts, and everything else below it. The run draws this floor
 * too, so the machines behind you are still there as the darkness rises.
 */
export const START_Y = 0;
/** Left of centre, so you appear in the open lane, not beside a machine. */
export const SPAWN_X = 365;
export const SPAWN_Y = -360;
export const MACHINE_HALF = 45;

/*
 * Laid out so that standing at the spawn - camera centred on the corridor,
 * showing x 110..650 - every machine near you is wholly on screen, and the
 * lane up the middle to the START line is clear for the widest character.
 */
const WEAPON_AT = { x: 170, y: -250 };
const PEDESTAL_AT = { x: 170, y: -470 };
/** POD machines: two columns down the right-hand side. */
const POD_COLS = [455, 592];
const POD_TOP = -250;
/*
 * Row to row. 150 left a 60-unit gap, and the lower machine's price tag sat
 * in it: on a phone the walk between two rows was a squeeze, and the tag
 * drew over the character. 220 leaves room for both.
 */
const POD_STEP = 220;
/** The yard of characters you own: three columns, all on screen from the lane. */
const YARD_COLS = [140, 215, 290];
const YARD_TOP = -700;
const YARD_STEP = 96;

export type MachineKind = 'pod' | 'weapon' | 'pedestal';

export interface Machine {
  readonly kind: MachineKind;
  readonly x: number;
  readonly y: number;
  /** POD number; 0 for the others. */
  readonly pod: number;
  readonly locked: boolean;
  /** Total score that opens a locked POD. */
  readonly unlockAt: number;
}

export interface YardSlot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface LobbyFloor {
  readonly machines: readonly Machine[];
  readonly yard: readonly YardSlot[];
  /** How far down you can walk. */
  readonly bottom: number;
}

/**
 * Where everything stands, given what this save owns and has unlocked. Every
 * open POD gets a machine, plus the next one, greyed, so the goal is in view.
 */
export function buildLobbyFloor(meta: MetaState): LobbyFloor {
  const machines: Machine[] = [
    { kind: 'weapon', ...WEAPON_AT, pod: 0, locked: false, unlockAt: 0 },
    { kind: 'pedestal', ...PEDESTAL_AT, pod: 0, locked: false, unlockAt: 0 },
  ];

  const open = meta.podsAvailable();
  const shown = Math.min(MAX_POD, open + 1);
  for (let pod = 1; pod <= shown; pod++) {
    const i = pod - 1;
    machines.push({
      kind: 'pod',
      x: POD_COLS[i % 2],
      y: POD_TOP - Math.floor(i / 2) * POD_STEP,
      pod,
      locked: pod > open,
      unlockAt: POD_UNLOCK_SCORES[pod - 2] ?? 0,
    });
  }

  // In roster order, which is POD order, so each machine's characters sit
  // together in the yard.
  const owned = meta
    .ownedIds()
    .filter((id) => CHARACTERS[id] !== undefined)
    .sort((a, b) => CHARACTER_IDS.indexOf(a) - CHARACTER_IDS.indexOf(b));
  const yard = owned.map((id, i) => ({
    id,
    x: YARD_COLS[i % YARD_COLS.length],
    y: YARD_TOP - Math.floor(i / YARD_COLS.length) * YARD_STEP,
  }));

  let low = YARD_TOP;
  for (const m of machines) low = Math.min(low, m.y - MACHINE_HALF);
  for (const s of yard) low = Math.min(low, s.y);
  return { machines, yard, bottom: low - 140 };
}

function machineColors(m: Machine): [string, string] {
  if (m.locked) return [COLOR.lockedMachine, COLOR.lockedMachineSide];
  if (m.kind === 'pod') return [COLOR.podMachine, COLOR.podMachineSide];
  if (m.kind === 'weapon') return [COLOR.weaponMachine, COLOR.weaponMachineSide];
  return [COLOR.pedestal, COLOR.pedestalSide];
}

/**
 * The floor in WORLD space: the start line, the machines, and the yard. The
 * character you currently are leaves an empty ring where it waits.
 */
export function drawLobbyFloor(
  c: CanvasRenderingContext2D,
  floor: LobbyFloor,
  currentId: string,
): void {
  // The START line: a checkered band right across the corridor.
  const sq = 20;
  for (let x = 0, i = 0; x < WORLD_W; x += sq, i++) {
    c.fillStyle = i % 2 === 0 ? COLOR.ink : COLOR.bg;
    c.fillRect(x, START_Y - sq / 2, sq, sq / 2);
    c.fillStyle = i % 2 === 0 ? COLOR.bg : COLOR.ink;
    c.fillRect(x, START_Y, sq, sq / 2);
  }

  for (const m of floor.machines) {
    const [body, side] = machineColors(m);
    const h = MACHINE_HALF;
    c.fillStyle = body;
    c.fillRect(m.x - h, m.y - h, h * 2, h * 2);
    // The face turned toward you, as on the obstacles.
    c.fillStyle = side;
    c.fillRect(m.x - h, m.y - h, h * 2, h * 0.42);
  }

  for (const s of floor.yard) {
    const def = CHARACTERS[s.id];
    if (def === undefined) continue;
    if (s.id === currentId) {
      c.strokeStyle = COLOR.hudDim;
      c.lineWidth = 2;
      c.setLineDash([5, 5]);
      c.beginPath();
      c.arc(s.x, s.y, 22, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      continue;
    }
    drawShape(c, def.shape, s.x, s.y, def.drawSize, 0, COLOR.lobbyIdle, COLOR.bg);
  }
}

/**
 * Everything on the floor that is TEXT, in UI space: price tags, machine
 * faces, run counts and the floor lettering. Separate from drawLobbyFloor
 * because text under the world transform would be mirrored. Anything below
 * `minY` (the darkness, during a run) is left undrawn.
 */
export function drawLobbyLabels(
  c: CanvasRenderingContext2D,
  floor: LobbyFloor,
  meta: MetaState,
  currentId: string,
  camX: number,
  camY: number,
  minY: number,
): void {
  const sx = (wx: number): number => wx - camX;
  const sy = (wy: number): number => VIEW_H / 2 - (wy - camY);
  const heavy = 'italic 900';
  const sans = 'ui-sans-serif, system-ui, sans-serif';
  c.textBaseline = 'middle';
  c.textAlign = 'center';

  const text = (s: string, wx: number, wy: number, font: string, color: string): void => {
    if (wy < minY) return;
    c.font = font;
    c.fillStyle = color;
    c.fillText(s, sx(wx), sy(wy));
  };

  // ---- floor lettering ---------------------------------------------------
  text('START', WORLD_W / 2, START_Y + 34, `${heavy} 30px ${sans}`, COLOR.ink);
  text('WALK OVER THE LINE TO START', WORLD_W / 2, START_Y - 36, `600 13px ui-monospace, Menlo, monospace`, COLOR.hudDim);
  text('TIME LOCKER', WORLD_W / 2, -104, `${heavy} 46px ${sans}`, COLOR.frame);
  text('FAN REMAKE', WORLD_W / 2, -140, `600 13px ui-monospace, Menlo, monospace`, COLOR.hudDim);
  text('DRAG TO MOVE', SPAWN_X, SPAWN_Y - 64, `600 13px ui-monospace, Menlo, monospace`, COLOR.hudDim);

  // ---- machines ------------------------------------------------------------
  for (const m of floor.machines) {
    if (m.y + MACHINE_HALF < minY) continue;
    const face = m.kind === 'pod' ? String(m.pod) : m.kind === 'weapon' ? '?' : 'FOREVER';
    const faceSize = m.kind === 'pedestal' ? 16 : 44;
    text(face, m.x, m.y + 10, `${heavy} ${faceSize}px ${sans}`, '#ffffff');

    const price =
      m.locked ? 'LOCKED' : m.kind === 'pod' ? `C ${POD_PULL_COST}` : m.kind === 'weapon' ? `C ${WEAPON_MACHINE_COST}` : `C ${POD_PERMANENT_COST}`;
    const [body] = machineColors(m);
    const tx = sx(m.x);
    const ty = sy(m.y + MACHINE_HALF + 20);
    if (m.y + MACHINE_HALF + 20 >= minY) {
      c.font = `${heavy} 18px ${sans}`;
      const w = c.measureText(price).width + 22;
      c.fillStyle = m.locked ? COLOR.hudDim : body;
      roundRect(c, tx - w / 2, ty - 15, w, 30, 6);
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillText(price, tx, ty + 1);
    }

    const name = m.kind === 'pod' ? `POD ${m.pod}` : m.kind === 'weapon' ? 'WEAPON' : 'KEEP FOREVER';
    text(name, m.x, m.y - MACHINE_HALF - 16, `700 13px ${sans}`, COLOR.hud);
  }

  // ---- runs left, on characters that are not yours for good ---------------
  for (const s of floor.yard) {
    if (s.id === currentId || meta.isPermanent(s.id) || s.y < minY) continue;
    usesBadge(c, sx(s.x) + 16, sy(s.y) - 18, meta.usesLeft(s.id));
  }
}

/** The original's little black disc with the runs left in it. */
export function usesBadge(c: CanvasRenderingContext2D, x: number, y: number, n: number): void {
  c.fillStyle = COLOR.ink;
  c.beginPath();
  c.arc(x, y, 10, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '800 12px ui-sans-serif, system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(n), x, y + 1);
}
