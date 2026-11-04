import type { MetaState } from './MetaState';

/**
 * Save codes: the whole save as one line of text, for moving progress
 * between browsers or sites. Storage is per-site and per-device, so this is
 * the only way a save gets from the old page to a new one.
 *
 *   TLR1.<base64url JSON>.<checksum>
 *
 * The version prefix lets a later format be told apart; the checksum catches
 * a code that lost characters on the way through the clipboard, which is the
 * failure that actually happens. It is NOT protection against editing - the
 * body is plain JSON for anyone who decodes it, and that is fine for a game
 * played among friends.
 */
const PREFIX = 'TLR1';

export type DecodeResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: 'empty' | 'format' | 'version' | 'damaged' };

export function encodeSave(meta: MetaState): string {
  const body = toBase64Url(JSON.stringify(meta.toJSON()));
  return `${PREFIX}.${body}.${checksum(body)}`;
}

export function decodeSave(input: string): DecodeResult {
  // Codes pasted from chat apps arrive wrapped, padded and line-broken.
  const code = input.replace(/\s+/g, '');
  if (code === '') return { ok: false, reason: 'empty' };

  const parts = code.split('.');
  const prefix = parts[0];
  if (!/^TLR\d+$/.test(prefix)) return { ok: false, reason: 'format' };
  if (prefix !== PREFIX) return { ok: false, reason: 'version' };
  // It starts like one of ours, so a wrong shape means a cut-off paste.
  if (parts.length !== 3) return { ok: false, reason: 'damaged' };
  const [, body, sum] = parts;
  if (checksum(body) !== sum) return { ok: false, reason: 'damaged' };

  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(body));
  } catch {
    return { ok: false, reason: 'damaged' };
  }
  // A code that decodes to something other than a save would load as an
  // empty one - a silent wipe - so the shape is checked before anything
  // offers to replace the player's progress with it.
  if (!looksLikeSave(data)) return { ok: false, reason: 'format' };
  return { ok: true, data };
}

function looksLikeSave(d: unknown): boolean {
  if (typeof d !== 'object' || d === null) return false;
  const s = d as Record<string, unknown>;
  return (
    typeof s.coins === 'number' &&
    typeof s.highScore === 'number' &&
    typeof s.totalScore === 'number' &&
    typeof s.owned === 'object' &&
    s.owned !== null
  );
}

/** FNV-1a, 32-bit, in base 36: short, and plenty to catch a truncated paste. */
function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function toBase64Url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
