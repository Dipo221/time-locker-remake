import { describe, expect, it } from 'vitest';
import { PLAYER_SOLID_RADIUS_FRAC, POD_UNLOCK_SCORES, WORLD_W } from '../config';
import { Rng } from '../core/rng';
import { CHARACTERS, CHARACTER_IDS, DEFAULT_CHARACTER, MAX_POD } from '../data/characters';
import { MetaState } from '../game/MetaState';
import { rollWeapon } from '../game/weaponDrops';
import { MACHINE_HALF, SPAWN_X, SPAWN_Y, START_Y, buildLobbyFloor } from './lobbyFloor';
import type { LobbyFloor } from './lobbyFloor';

/** Every POD open and every character owned: the most crowded lobby there is. */
function fullSave(): MetaState {
  const m = new MetaState();
  m.totalScore = 10_000_000;
  for (const id of CHARACTER_IDS) m.grant(id, 3);
  return m;
}

/** The widest body any character walks the lobby with. */
const WIDEST = Math.max(...Object.values(CHARACTERS).map((d) => d.drawSize)) * PLAYER_SOLID_RADIUS_FRAC;
/** Room a waiting character takes up on the floor. */
const SLOT_R = 26;

function boxesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, gap: number): boolean {
  return Math.abs(a.x - b.x) < MACHINE_HALF * 2 + gap && Math.abs(a.y - b.y) < MACHINE_HALF * 2 + gap;
}

describe('lobby floor', () => {
  it('a new save: two shop machines, POD 1, POD 2 in view but locked, and you', () => {
    const f = buildLobbyFloor(new MetaState());
    const pods = f.machines.filter((m) => m.kind === 'pod');
    expect(f.machines.filter((m) => m.kind === 'weapon')).toHaveLength(1);
    expect(f.machines.filter((m) => m.kind === 'pedestal')).toHaveLength(1);
    expect(pods.map((m) => [m.pod, m.locked])).toEqual([[1, false], [2, true]]);
    expect(pods[1].unlockAt).toBe(POD_UNLOCK_SCORES[0]);
    expect(f.yard.map((s) => s.id)).toEqual([DEFAULT_CHARACTER]);
  });

  it('shows only the next locked POD, never all of them', () => {
    const m = new MetaState();
    m.totalScore = POD_UNLOCK_SCORES[3];
    const pods = buildLobbyFloor(m).machines.filter((x) => x.kind === 'pod');
    expect(pods.filter((x) => x.locked)).toHaveLength(1);
    expect(pods.filter((x) => !x.locked)).toHaveLength(m.podsAvailable());
  });

  describe('fully unlocked', () => {
    const f: LobbyFloor = buildLobbyFloor(fullSave());

    it('has every POD and every character', () => {
      expect(f.machines.filter((m) => m.kind === 'pod')).toHaveLength(MAX_POD);
      expect(f.yard).toHaveLength(CHARACTER_IDS.length);
    });

    it('keeps everything inside the walls', () => {
      for (const m of f.machines) {
        expect(m.x - MACHINE_HALF).toBeGreaterThan(10);
        expect(m.x + MACHINE_HALF).toBeLessThan(WORLD_W - 10);
      }
      for (const s of f.yard) {
        expect(s.x - SLOT_R).toBeGreaterThan(10);
        expect(s.x + SLOT_R).toBeLessThan(WORLD_W - 10);
      }
    });

    it('never stacks one thing on another', () => {
      // Machines leave a body's width between them, so you can walk between.
      for (let i = 0; i < f.machines.length; i++) {
        for (let j = i + 1; j < f.machines.length; j++) {
          expect(boxesOverlap(f.machines[i], f.machines[j], WIDEST * 2)).toBe(false);
        }
      }
      for (const s of f.yard) {
        for (const m of f.machines) {
          const gx = Math.max(Math.abs(s.x - m.x) - MACHINE_HALF, 0);
          const gy = Math.max(Math.abs(s.y - m.y) - MACHINE_HALF, 0);
          expect(Math.hypot(gx, gy)).toBeGreaterThan(SLOT_R);
        }
      }
    });

    it('lines the yard up on the left, under the shop machines', () => {
      // The middle is a lane; things stand to either side of it.
      const leftEdge = Math.max(
        ...f.machines.filter((m) => m.kind !== 'pod').map((m) => m.x + MACHINE_HALF),
      );
      for (const s of f.yard) expect(s.x).toBeLessThanOrEqual(leftEdge);
    });

    it('leaves a clear lane from where you appear to the START line', () => {
      expect(SPAWN_Y).toBeLessThan(START_Y - 200);
      expect(f.bottom).toBeLessThan(SPAWN_Y);
      for (const m of f.machines) {
        const clear = Math.abs(m.x - SPAWN_X) >= MACHINE_HALF + WIDEST;
        expect(clear, `machine at ${m.x},${m.y} blocks the lane`).toBe(true);
      }
      for (const s of f.yard) {
        // Brushing a waiting character on the way would switch you to it.
        expect(Math.abs(s.x - SPAWN_X)).toBeGreaterThan(SLOT_R + WIDEST + 20);
      }
    });
  });

  it('the weapon machine pays out with the same rarities as drops', () => {
    const rng = new Rng(7);
    const n = new Map<string, number>();
    for (let i = 0; i < 20000; i++) {
      const id = rollWeapon(rng);
      n.set(id, (n.get(id) ?? 0) + 1);
    }
    // TWIN SHOT is the commonest drop and SUPPORTER the rarest.
    expect(n.get('TWIN_SHOT') ?? 0).toBeGreaterThan(10 * (n.get('SUPPORTER') ?? 0));
    expect(n.size).toBe(12);
  });
});
