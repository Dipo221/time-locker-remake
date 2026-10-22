import { describe, expect, it } from 'vitest';
import { LOADOUT_MAX_BARRELS } from '../../config';
import { CHARACTERS } from '../../data/characters';
import { compileLoadout } from './compile';
import type { CompiledLoadout, WeaponId } from './types';

const ALL: WeaponId[] = ['TWIN_SHOT', 'WIDE_SHOT', 'SIDE_SHOT'];

function loadoutOf(n: number, char = CHARACTERS.theLocker): CompiledLoadout {
  const stacks = new Map<WeaponId, number>();
  if (n > 0) for (const id of ALL) stacks.set(id, n);
  return compileLoadout(char, stacks);
}

/** Total damage per second across every barrel of every emitter. */
function dps(l: CompiledLoadout): number {
  return l.emitters.reduce(
    (a, e) => a + (e.anglesRad.length * e.burst * e.damage) / e.cadence,
    0,
  );
}

/**
 * The stacking contract. The original stacks weapons without limit, and this
 * is where that promise is kept honestly.
 *
 * An earlier implementation refused emitters that did not fit under the barrel
 * ceiling, which meant that past about ten stacks the loadout silently
 * collapsed back to the character's innate gun - every further pickup made the
 * player dramatically WEAKER. Nothing crashed and nothing type-errored; it
 * only showed up as a number going the wrong way. Hence this test.
 */
describe('compileLoadout stacking', () => {
  const counts = [0, 1, 2, 3, 5, 8, 10, 15, 20, 40, 80, 150, 400, 1000];

  it('firepower increases strictly with every stack', () => {
    let prev = -Infinity;
    for (const n of counts) {
      const d = dps(loadoutOf(n));
      expect(d, `dps at ${n} stacks must exceed ${prev}`).toBeGreaterThan(prev);
      prev = d;
    }
  });

  it('never exceeds the barrel ceiling, however many stacks', () => {
    for (const n of counts) {
      const l = loadoutOf(n);
      expect(l.barrels, `barrels at ${n} stacks`).toBeLessThanOrEqual(
        LOADOUT_MAX_BARRELS,
      );
    }
  });

  it('keeps every emitter alive once the ceiling binds', () => {
    // The collapse bug manifested as the emitter list shrinking under load.
    const base = loadoutOf(1).emitters.length;
    for (const n of [20, 80, 400]) {
      expect(loadoutOf(n).emitters.length, `emitters at ${n} stacks`).toBe(base);
    }
  });

  it('reports overflow only once the ceiling actually binds', () => {
    expect(loadoutOf(1).overflow).toBe(0);
    expect(loadoutOf(400).overflow).toBeGreaterThan(0);
  });
});

describe('character modifiers', () => {
  it('WIDE RHINO enlarges the WIDE SHOT it picks up', () => {
    const stacks = new Map<WeaponId, number>([['WIDE_SHOT', 1]]);
    const plain = compileLoadout(CHARACTERS.theLocker, stacks);
    const rhino = compileLoadout(CHARACTERS.wideRhino, stacks);

    const widest = (l: CompiledLoadout): number =>
      Math.max(...l.emitters.map((e) => e.size));
    expect(widest(rhino)).toBeGreaterThan(widest(plain));
  });

  it('ANT BEAR really has no gun at all', () => {
    expect(compileLoadout(CHARACTERS.antBear, new Map()).emitters).toHaveLength(
      0,
    );
  });
});
