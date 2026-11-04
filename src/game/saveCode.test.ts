import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../data/characters';
import { MetaState } from './MetaState';
import { decodeSave, encodeSave } from './saveCode';

/** A save with something in every field, including a fully-owned roster. */
function richSave(): MetaState {
  const m = new MetaState();
  m.coins = 4321;
  m.highScore = 98765;
  m.totalScore = 1234567;
  for (const id of CHARACTER_IDS) m.grant(id, 3);
  m.buyPermanent(CHARACTER_IDS[5]);
  m.selected = CHARACTER_IDS[5];
  return m;
}

function decodeInto(code: string): MetaState {
  const r = decodeSave(code);
  if (!r.ok) throw new Error(`decode failed: ${r.reason}`);
  const m = new MetaState();
  m.load(r.data);
  return m;
}

describe('save codes', () => {
  it('carry a save across exactly', () => {
    const before = richSave();
    const after = decodeInto(encodeSave(before));
    expect(after.toJSON()).toEqual(before.toJSON());
  });

  it('survive the wrapping and spacing a chat app adds', () => {
    const code = encodeSave(richSave());
    const mangled = `  ${code.slice(0, 40)}\n${code.slice(40, 90)}\r\n ${code.slice(90)}  `;
    expect(decodeInto(mangled).toJSON()).toEqual(richSave().toJSON());
  });

  it('refuse a code that lost its tail on the way', () => {
    const code = encodeSave(richSave());
    const [p, body, sum] = code.split('.');
    const cut = `${p}.${body.slice(0, body.length - 9)}.${sum}`;
    expect(decodeSave(cut)).toEqual({ ok: false, reason: 'damaged' });
    // Cut before the checksum: still ours, still damaged, not "foreign".
    expect(decodeSave(code.slice(0, 120))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('refuse a code whose body was altered', () => {
    const code = encodeSave(richSave());
    const i = code.indexOf('.') + 5;
    const flipped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeSave(flipped)).toEqual({ ok: false, reason: 'damaged' });
  });

  it('tell empty, foreign and future codes apart', () => {
    expect(decodeSave('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(decodeSave('hello world')).toEqual({ ok: false, reason: 'format' });
    expect(decodeSave('TLR9.abc.def')).toEqual({ ok: false, reason: 'version' });
  });

  it('never offer to load something that is not a save', () => {
    // A well-formed code around the wrong JSON would load as an empty save,
    // wiping the player's progress, so it must be refused outright.
    const body = btoa('{"hello":1}').replace(/=+$/, '');
    let h = 0x811c9dc5;
    for (let i = 0; i < body.length; i++) {
      h ^= body.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const code = `TLR1.${body}.${(h >>> 0).toString(36)}`;
    expect(decodeSave(code)).toEqual({ ok: false, reason: 'format' });
  });
});
