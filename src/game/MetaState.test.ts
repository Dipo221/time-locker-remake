import { describe, expect, it } from 'vitest';
import {
  POD_PERMANENT_COST,
  POD_PULL_COST,
  POD_PULL_USES,
  POD_UNLOCK_SCORES,
} from '../config';
import { Rng } from '../core/rng';
import { CHARACTERS, DEFAULT_CHARACTER, charactersInPod } from '../data/characters';
import { MetaState } from './MetaState';

function meta(coins = 0): MetaState {
  const m = new MetaState();
  m.coins = coins;
  return m;
}

describe('ownership', () => {
  it('starts with the free character and nothing else', () => {
    const m = meta();
    expect(m.ownedIds()).toEqual([DEFAULT_CHARACTER]);
    expect(m.isPermanent(DEFAULT_CHARACTER)).toBe(true);
  });

  it('never spends a use on the free character', () => {
    const m = meta();
    for (let i = 0; i < 50; i++) m.consumeUse(DEFAULT_CHARACTER);
    expect(m.isOwned(DEFAULT_CHARACTER)).toBe(true);
  });
});

describe('the vending machine', () => {
  it('charges, and grants the original three runs', () => {
    const m = meta(POD_PULL_COST);
    const got = m.pull(1, new Rng(1));

    expect(got).not.toBeNull();
    expect(m.coins).toBe(0);
    if (got !== null) {
      expect(m.usesLeft(got)).toBe(POD_PULL_USES);
      expect(m.isPermanent(got)).toBe(false);
    }
  });

  it('refuses when you cannot afford it', () => {
    const m = meta(POD_PULL_COST - 1);
    expect(m.pull(1, new Rng(1))).toBeNull();
    expect(m.coins).toBe(POD_PULL_COST - 1);
  });

  it('refuses a machine that has not been unlocked yet', () => {
    const m = meta(100000);
    expect(m.podsAvailable()).toBe(1);
    expect(m.pull(2, new Rng(1))).toBeNull();
  });

  it('only dispenses characters belonging to that machine', () => {
    const m = meta(POD_PULL_COST * 40);
    m.totalScore = 1e9; // open everything
    const rng = new Rng(9);
    for (let i = 0; i < 30; i++) {
      const got = m.pull(2, rng);
      if (got === null) break;
      expect(CHARACTERS[got]?.pod).toBe(2);
    }
  });

  it('runs out, and falls back to the free character', () => {
    const m = meta(POD_PULL_COST);
    const got = m.pull(1, new Rng(3));
    expect(got).not.toBeNull();
    if (got === null) return;

    m.selected = got;
    for (let i = 0; i < POD_PULL_USES; i++) m.consumeUse(got);

    expect(m.isOwned(got), 'should be spent').toBe(false);
    expect(m.selected, 'must not strand the player on a lost character').toBe(
      DEFAULT_CHARACTER,
    );
  });
});

/**
 * The fix for the original's most complained-about rule: a pulled character
 * vanished after three runs and could not be kept at any price.
 */
describe('permanent unlock', () => {
  it('keeps a character for good, and stops consuming uses', () => {
    const m = meta(POD_PULL_COST + POD_PERMANENT_COST);
    const got = m.pull(1, new Rng(5));
    expect(got).not.toBeNull();
    if (got === null) return;

    expect(m.buyPermanent(got)).toBe(true);
    for (let i = 0; i < 100; i++) m.consumeUse(got);
    expect(m.isOwned(got)).toBe(true);
    expect(m.isPermanent(got)).toBe(true);
  });

  it('cannot be bought for a character you do not hold', () => {
    const m = meta(POD_PERMANENT_COST * 5);
    const other = charactersInPod(1)[0];
    expect(other).toBeDefined();
    if (other === undefined) return;
    expect(m.buyPermanent(other.id)).toBe(false);
    expect(m.coins, 'must not charge for a failed purchase').toBe(
      POD_PERMANENT_COST * 5,
    );
  });

  it('cannot be bought twice', () => {
    const m = meta(POD_PULL_COST + POD_PERMANENT_COST * 2);
    const got = m.pull(1, new Rng(5));
    if (got === null) throw new Error('no pull');
    expect(m.buyPermanent(got)).toBe(true);
    const after = m.coins;
    expect(m.buyPermanent(got)).toBe(false);
    expect(m.coins).toBe(after);
  });
});

describe('machines open with cumulative score', () => {
  it('opens the next one at its threshold', () => {
    const m = meta();
    expect(m.podsAvailable()).toBe(1);
    m.totalScore = POD_UNLOCK_SCORES[0] ?? 0;
    expect(m.podsAvailable()).toBe(2);
  });

  it('accumulates across runs rather than taking the best', () => {
    const m = meta();
    const third = (POD_UNLOCK_SCORES[0] ?? 3000) / 3;
    m.bankRun(third, 5);
    m.bankRun(third, 5);
    m.bankRun(third, 5);
    expect(m.totalScore).toBeGreaterThanOrEqual(POD_UNLOCK_SCORES[0] ?? 0);
    expect(m.highScore, 'high score is the best run, not the sum').toBe(third);
  });
});

describe('persistence', () => {
  it('round-trips through JSON', () => {
    const a = meta(777);
    a.totalScore = 5000;
    a.bankRun(1234, 10);
    const got = a.pull(1, new Rng(2));
    if (got !== null) a.buyPermanent(got);

    const b = new MetaState();
    b.load(JSON.parse(JSON.stringify(a.toJSON())));

    expect(b.coins).toBe(a.coins);
    expect(b.highScore).toBe(a.highScore);
    expect(b.totalScore).toBe(a.totalScore);
    expect(b.selected).toBe(a.selected);
    for (const id of a.ownedIds()) {
      expect(b.isOwned(id), `${id} should survive a save`).toBe(true);
      expect(b.isPermanent(id)).toBe(a.isPermanent(id));
    }
  });

  it('survives junk without throwing', () => {
    for (const junk of [null, 42, 'nope', {}, { owned: 7 }, { coins: NaN }]) {
      const m = new MetaState();
      expect(() => m.load(junk)).not.toThrow();
      expect(m.isOwned(DEFAULT_CHARACTER)).toBe(true);
      expect(Number.isFinite(m.coins)).toBe(true);
    }
  });

  it('drops characters that no longer exist', () => {
    const m = new MetaState();
    m.load({
      coins: 10,
      highScore: 0,
      totalScore: 0,
      selected: 'someRemovedCharacter',
      owned: { someRemovedCharacter: { uses: 3, permanent: true } },
    });
    expect(m.isOwned('someRemovedCharacter')).toBe(false);
    expect(m.selected, 'must not select a character that is gone').toBe(
      DEFAULT_CHARACTER,
    );
  });
});
