import { COLOR } from '../config';
import { MetaState, saveMeta } from '../game/MetaState';
import { decodeSave, encodeSave } from '../game/saveCode';
import type { DecodeResult } from '../game/saveCode';

/**
 * The SAVE panel: copy your save out as a code, or paste one in.
 *
 * Plain HTML over the canvas rather than canvas-drawn, because it needs a
 * real text box: pasting, long-press copy and the phone keyboard all come
 * free with a <textarea> and would each be a project on a canvas. The page
 * otherwise disables selection and touch gestures for play, so the panel
 * turns them back on for itself.
 *
 * Nothing is replaced without a confirmation that shows both saves side by
 * side, and a bad code never touches the current save.
 */

const CSS = `
.tl-save { position: fixed; inset: 0; z-index: 10; display: flex;
  align-items: center; justify-content: center; padding: 16px;
  background: rgba(20, 22, 26, 0.72);
  font: 15px/1.4 ui-sans-serif, system-ui, sans-serif; color: ${COLOR.ink};
  -webkit-user-select: text; user-select: text; touch-action: auto;
  -webkit-touch-callout: default; }
.tl-save .card { background: ${COLOR.bg}; border-radius: 12px; width: 100%;
  max-width: 420px; max-height: 100%; overflow-y: auto; padding: 18px; }
.tl-save .head { display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 12px; }
.tl-save h2 { font-size: 20px; margin: 0; letter-spacing: 0.04em; }
.tl-save h3 { font-size: 13px; margin: 16px 0 6px; color: ${COLOR.hudDim};
  letter-spacing: 0.06em; }
.tl-save p { margin: 0 0 8px; font-size: 13px; color: #55524c; }
.tl-save textarea { width: 100%; height: 84px; resize: none; padding: 8px;
  border: 1.5px solid ${COLOR.frame}; border-radius: 8px; background: #fff;
  color: ${COLOR.ink}; font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace;
  word-break: break-all; }
.tl-save button { font: 600 15px ui-sans-serif, system-ui, sans-serif;
  border-radius: 8px; padding: 10px 14px; cursor: pointer;
  border: 1.5px solid rgba(43, 108, 246, 0.35);
  background: rgba(43, 108, 246, 0.10); color: ${COLOR.playerShot}; }
.tl-save button.primary { background: ${COLOR.playerShot}; color: #fff;
  border-color: ${COLOR.playerShot}; }
.tl-save .row { display: flex; gap: 8px; margin-top: 8px; }
.tl-save .row button { flex: 1; }
.tl-save .msg { min-height: 20px; margin-top: 6px; font-size: 13px; }
.tl-save .msg.bad { color: ${COLOR.enemyShotEdge}; }
.tl-save .msg.good { color: #1d7f4e; }
.tl-save table { width: 100%; border-collapse: collapse; margin: 6px 0;
  font-size: 14px; }
.tl-save th, .tl-save td { padding: 5px 4px; text-align: right;
  border-bottom: 1px solid ${COLOR.gridMark}; }
.tl-save th:first-child, .tl-save td:first-child { text-align: left; }
`;

const REASONS: Record<Exclude<DecodeResult, { ok: true }>['reason'], string> = {
  empty: 'Paste a save code first.',
  format: 'That is not a save code.',
  version: 'That code is from a different version of the game.',
  damaged: 'That code is damaged - part of it may be missing. Copy it again.',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...children);
  return e;
}

export class SavePanel {
  private root: HTMLDivElement | null = null;

  get isOpen(): boolean {
    return this.root !== null;
  }

  /** `onReplaced` runs after an import has overwritten `meta`. */
  open(meta: MetaState, onReplaced: () => void): void {
    if (this.root !== null) return;
    if (document.getElementById('tl-save-css') === null) {
      document.head.append(el('style', { id: 'tl-save-css', textContent: CSS }));
    }

    const close = el('button', { textContent: 'CLOSE', onclick: () => this.close() });

    // ---- export ----------------------------------------------------------
    const out = el('textarea', { readOnly: true, value: encodeSave(meta) });
    out.addEventListener('focus', () => out.select());
    const outMsg = el('div', { className: 'msg' });
    const copy = el('button', { className: 'primary', textContent: 'COPY SAVE CODE' });
    copy.onclick = () => {
      out.value = encodeSave(meta);
      const fallback = (): void => {
        out.focus();
        out.select();
        outMsg.className = 'msg';
        outMsg.textContent = 'Could not copy automatically - the code is selected, copy it from the box.';
      };
      // Must run inside the click: browsers only allow a clipboard write
      // during a user gesture, and some hosts refuse it outright.
      try {
        navigator.clipboard.writeText(out.value).then(() => {
          outMsg.className = 'msg good';
          outMsg.textContent = 'Copied. Paste it on the other page, under LOAD SAVE CODE.';
        }, fallback);
      } catch {
        fallback();
      }
    };

    // ---- import ----------------------------------------------------------
    const inp = el('textarea', { placeholder: 'Paste a save code here' });
    const inMsg = el('div', { className: 'msg' });
    const load = el('button', { className: 'primary', textContent: 'LOAD SAVE CODE' });
    const importBox = el('div', {}, inp, el('div', { className: 'row' }, load), inMsg);

    load.onclick = () => {
      const r = decodeSave(inp.value);
      if (!r.ok) {
        inMsg.className = 'msg bad';
        inMsg.textContent = REASONS[r.reason];
        return;
      }
      // Preview through a scratch MetaState, so the numbers shown are the
      // ones that will actually load (unknown characters dropped and so on).
      const incoming = new MetaState();
      incoming.load(r.data);
      importBox.replaceChildren(this.confirm(meta, incoming, r.data, () => {
        out.value = encodeSave(meta);
        importBox.replaceChildren(inp, el('div', { className: 'row' }, load), inMsg);
        inp.value = '';
        inMsg.className = 'msg good';
        inMsg.textContent = 'Save loaded.';
        onReplaced();
      }, () => {
        importBox.replaceChildren(inp, el('div', { className: 'row' }, load), inMsg);
        inMsg.className = 'msg';
        inMsg.textContent = 'Nothing was changed.';
      }));
    };

    const card = el(
      'div',
      { className: 'card' },
      el('div', { className: 'head' }, el('h2', { textContent: 'SAVE DATA' }), close),
      el('p', {
        textContent:
          'Your progress lives in this browser only. To move it to another ' +
          'browser, phone or site, copy the code here and load it there.',
      }),
      el('h3', { textContent: 'EXPORT' }),
      out,
      el('div', { className: 'row' }, copy),
      outMsg,
      el('h3', { textContent: 'IMPORT' }),
      importBox,
    );

    const root = el('div', { className: 'tl-save' }, card);
    // A tap on the dimmed backdrop closes; taps inside the card do not.
    root.addEventListener('pointerdown', (e) => {
      if (e.target === root) this.close();
    });
    document.body.append(root);
    this.root = root;
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }

  private confirm(
    meta: MetaState,
    incoming: MetaState,
    data: unknown,
    done: () => void,
    cancel: () => void,
  ): HTMLElement {
    const row = (name: string, a: number, b: number): HTMLTableRowElement =>
      el('tr', {}, el('td', { textContent: name }), el('td', { textContent: String(a) }), el('td', { textContent: String(b) }));

    const replace = el('button', { className: 'primary', textContent: 'REPLACE' });
    replace.onclick = () => {
      meta.load(data);
      saveMeta(meta);
      done();
    };
    const keep = el('button', { textContent: 'CANCEL', onclick: cancel });

    return el(
      'div',
      {},
      el('p', { textContent: 'Replace the save in this browser with the one in the code? This cannot be undone.' }),
      el(
        'table',
        {},
        el('tr', {}, el('th', { textContent: '' }), el('th', { textContent: 'NOW' }), el('th', { textContent: 'CODE' })),
        row('Coins', meta.coins, incoming.coins),
        row('Best', meta.highScore, incoming.highScore),
        row('Total score', meta.totalScore, incoming.totalScore),
        row('Characters', meta.ownedIds().length, incoming.ownedIds().length),
      ),
      el('div', { className: 'row' }, keep, replace),
    );
  }
}
