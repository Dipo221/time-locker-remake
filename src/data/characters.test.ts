import { describe, expect, it } from 'vitest';
import { POD_UNLOCK_SCORES } from '../config';
import { compileLoadout } from '../game/weapons/compile';
import type { WeaponId } from '../game/weapons/types';
import { CHARACTERS, CHARACTER_IDS, MAX_POD, charactersInPod } from './characters';
import { DRONES } from './drones';
import { SHAPES } from './shapes';
import { WEAPONS } from './weapons';

const ALL_WEAPON_IDS = new Set<string>([
  ...Object.keys(WEAPONS),
  ...Object.keys(DRONES),
]);

/**
 * The roster is eighty-one hand-written entries. Most mistakes in data like
 * this do not crash - a misspelt weapon id in a modifier simply never matches,
 * a start weapon that does not exist is silently skipped - so the character
 * just quietly does less than its description says. These checks are what
 * stand between a typo and a character that is broken in a way nobody notices.
 */
describe('character roster integrity', () => {
  it('has the original eighty-one', () => {
    expect(CHARACTER_IDS).toHaveLength(81);
  });

  it('keys every entry by its own id', () => {
    for (const id of CHARACTER_IDS) {
      expect(CHARACTERS[id]?.id, `${id} is filed under the wrong key`).toBe(id);
    }
  });

  it('uses the source\'s machine layout', () => {
    // One free character, four in the first machine, three in each of the
    // next twenty-three, and the seven formerly-paid ones in the last.
    expect(MAX_POD).toBe(25);
    expect(charactersInPod(1)).toHaveLength(4);
    for (let pod = 2; pod <= 24; pod++) {
      expect(charactersInPod(pod), `POD ${pod}`).toHaveLength(3);
    }
    expect(charactersInPod(25)).toHaveLength(7);
    const free = CHARACTER_IDS.filter((id) => CHARACTERS[id]?.pod === undefined);
    expect(free).toEqual(['theLocker']);
  });

  it('has one unlock threshold per machine after the first', () => {
    expect(POD_UNLOCK_SCORES).toHaveLength(MAX_POD - 1);
    for (let i = 1; i < POD_UNLOCK_SCORES.length; i++) {
      expect(POD_UNLOCK_SCORES[i], 'thresholds must rise').toBeGreaterThan(
        POD_UNLOCK_SCORES[i - 1] ?? 0,
      );
    }
  });

  it('only references shapes that exist', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      expect(SHAPES[c.shape], `${id} body`).toBeDefined();
      for (const e of c.innate) {
        expect(SHAPES[e.projectile.shape], `${id}/${e.id} shot`).toBeDefined();
      }
    }
  });

  it('only references weapons that exist', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      for (const w of c.startWeapons ?? []) {
        expect(ALL_WEAPON_IDS.has(w), `${id} starts with unknown ${w}`).toBe(true);
      }
      for (const m of c.modifiers) {
        if (m.when.weaponId === undefined) continue;
        expect(
          ALL_WEAPON_IDS.has(m.when.weaponId),
          `${id} modifies unknown ${m.when.weaponId}`,
        ).toBe(true);
      }
    }
  });

  it('compiles every character, bare and fully loaded', () => {
    const everything = new Map<WeaponId, number>(
      [...ALL_WEAPON_IDS].map((w) => [w as WeaponId, 3]),
    );
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      expect(() => compileLoadout(c, new Map()), id).not.toThrow();
      const full = compileLoadout(c, everything);
      for (const e of full.emitters) {
        expect(Number.isFinite(e.cadence) && e.cadence > 0, `${id} cadence`).toBe(true);
        expect(Number.isFinite(e.damage), `${id} damage`).toBe(true);
      }
    }
  });

  it('gives every character a gun, a companion, or a stated reason not to', () => {
    // ANT BEAR is the one deliberately unarmed character; anything else with
    // nothing to fire is a data mistake, not a design.
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      const armed = c.innate.length > 0 || (c.startWeapons?.length ?? 0) > 0;
      if (id === 'antBear') expect(armed).toBe(false);
      else expect(armed, `${id} has nothing to shoot with`).toBe(true);
    }
  });

  it('keeps ANT BEAR the smallest hitbox and T-REX among the largest', () => {
    const radii = CHARACTER_IDS.map((id) => CHARACTERS[id].hitboxRadius);
    expect(CHARACTERS.antBear?.hitboxRadius).toBe(Math.min(...radii));
    expect(CHARACTERS.tRex?.hitboxRadius).toBe(Math.max(...radii));
  });
});
