/* HyPad - floating scratchpad + Notepad hybrid */
(() => {
'use strict';
Neutralino.init();

const $ = id => document.getElementById(id);
const ed = $('editor');

/* ------------------------------------------------------------------
   Rich editor core.
   The editor is a contenteditable surface, so bold/headings/lists are
   really rendered instead of showing their Markdown syntax. Everything
   still round-trips to Markdown for storage, search, history and files,
   via the .value shim below.
   ------------------------------------------------------------------ */
const plainText = () => ed.innerText.replace(/\r/g, '');

// Markdown <- DOM
function htmlToMd(root) {
  const out = [];
  const inlineMd = node => {
    let s = '';
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { s += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === 'br') { s += '\n'; return; }
      const inner = inlineMd(n);
      if (tag === 'b' || tag === 'strong') s += inner.trim() ? '**' + inner + '**' : inner;
      else if (tag === 'i' || tag === 'em') s += inner.trim() ? '*' + inner + '*' : inner;
      else if (tag === 's' || tag === 'strike' || tag === 'del') s += '~~' + inner + '~~';
      else if (tag === 'code') s += '`' + inner + '`';
      else if (tag === 'a') s += '[' + inner + '](' + (n.getAttribute('href') || '') + ')';
      else s += inner;
    });
    return s;
  };
  const block = (el, depth) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (el.classList && el.classList.contains('lcard')) { out.push(el.dataset.url || ''); return; }
    if (/^h[1-6]$/.test(tag)) { out.push('#'.repeat(+tag[1]) + ' ' + inlineMd(el)); return; }
    if (tag === 'blockquote') { el.childNodes.forEach(c => c.nodeType === 1 ? block(c, depth) : out.push('> ' + c.nodeValue)); return; }
    if (tag === 'ul' || tag === 'ol') {
      let i = 1;
      el.querySelectorAll(':scope > li').forEach(li => {
        const pad = '  '.repeat(depth);
        out.push(pad + (tag === 'ol' ? (i++) + '. ' : '- ') + inlineMd(li).split('\n')[0]);
        li.querySelectorAll(':scope > ul, :scope > ol').forEach(sub => block(sub, depth + 1));
      });
      return;
    }
    if (tag === 'hr') { out.push('---'); return; }
    if (tag === 'pre') { out.push('```', el.innerText, '```'); return; }
    const line = inlineMd(el);
    out.push(line);
  };
  root.childNodes.forEach(n => {
    if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push(n.nodeValue); return; }
    if (n.nodeType === 1) block(n, 0);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// DOM <- Markdown (mdToHtml is defined further down and is hoisted)
function setDocFromMd(md) {
  ed.innerHTML = md && md.trim() ? mdToHtml(md) : '<div><br></div>';
  hydrateCards();
}

/* .value / selection shim: existing code keeps talking Markdown + offsets */
Object.defineProperty(ed, 'value', {
  get() { return htmlToMd(ed); },
  set(v) { setDocFromMd(v); },
  configurable: true
});
function caretOffset(which) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !ed.contains(sel.anchorNode)) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(ed);
  const end = which === 'end' ? sel.getRangeAt(0).endContainer : sel.getRangeAt(0).startContainer;
  const off = which === 'end' ? sel.getRangeAt(0).endOffset : sel.getRangeAt(0).startOffset;
  try { r.setEnd(end, off); } catch (e) { return 0; }
  return r.toString().length;
}
Object.defineProperty(ed, 'selectionStart', { get: () => caretOffset('start'), configurable: true });
Object.defineProperty(ed, 'selectionEnd', { get: () => caretOffset('end'), configurable: true });
ed.setSelectionRange = (a, b) => {
  const walk = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  let seen = 0, s = null, e = null, n;
  while ((n = walk.nextNode())) {
    const len = n.nodeValue.length;
    if (!s && seen + len >= a) s = [n, a - seen];
    if (!e && seen + len >= (b === undefined ? a : b)) { e = [n, (b === undefined ? a : b) - seen]; break; }
    seen += len;
  }
  if (!s) return;
  const r = document.createRange();
  r.setStart(s[0], Math.min(s[1], s[0].nodeValue.length));
  if (e) r.setEnd(e[0], Math.min(e[1], e[0].nodeValue.length)); else r.collapse(true);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
};

/* link cards: clickable, not editable, deletable as a single unit */
const CARD_W = 294;
function hydrateCards() {
  ed.querySelectorAll('.lcard').forEach(c => {
    c.setAttribute('contenteditable', 'false');
    if (!c.dataset.url) c.dataset.url = c.getAttribute('href') || '';

    // cards written by an older build were block level and 420px wide
    if (c.classList.contains('media')) {
      const w = parseInt(c.style.width, 10);
      if (!w || w > 400) c.style.width = CARD_W + 'px';
    }
    c.style.display = 'inline-block';
    c.style.verticalAlign = 'bottom';

    // lift a card out of its own empty wrapper so it joins the text above
    const p = c.parentElement;
    if (p && p !== ed && /^(DIV|P)$/.test(p.tagName)) {
      const meaningful = Array.from(p.childNodes).filter(n =>
        n !== c && !(n.nodeType === 3 && !n.nodeValue.trim()) && !(n.nodeType === 1 && n.tagName === 'BR'));
      if (!meaningful.length) {
        const prev = p.previousElementSibling;
        if (prev && /^(DIV|P|H1|H2|H3|LI|BLOCKQUOTE)$/.test(prev.tagName)) {
          prev.appendChild(document.createTextNode('\u200b'));
          prev.appendChild(c);
          p.remove();
        }
      }
    }

    // caret anchors on both sides so you can type right before or after it
    c.setAttribute('draggable', 'true');
    const anchor = side => {
      const n = side === 'before' ? c.previousSibling : c.nextSibling;
      if (!n || n.nodeType !== 3) {
        c.parentNode.insertBefore(document.createTextNode('\u200b'),
          side === 'before' ? c : c.nextSibling);
      }
    };
    anchor('before'); anchor('after');
  });
}
/* drag the bottom-right grip to resize a preview; the width is inline,
   so it is stored with the note and survives restarts */
let rszTarget = null, rszStart = null;
function initResize() {
  // arrow keys should step over a preview like a single character
  ed.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const side = e.key === 'ArrowRight' ? r.endContainer.nextSibling : r.startContainer.previousSibling;
    if (side && side.nodeType === 1 && side.classList && side.classList.contains('lcard')) {
      e.preventDefault();
      const t = document.createTextNode('');
      side.parentNode.insertBefore(t, e.key === 'ArrowRight' ? side.nextSibling : side);
      const nr = document.createRange(); nr.setStart(t, 0); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
    }
  });
  ed.addEventListener('pointerdown', e => {
    const grip = e.target.closest('.rsz');
    if (!grip) return;
    const fig = grip.closest('.media');
    if (!fig) return;
    e.preventDefault(); e.stopPropagation();
    rszTarget = fig;
    rszStart = { x: e.clientX, w: fig.getBoundingClientRect().width };
    grip.setPointerCapture(e.pointerId);
    fig.classList.add('resizing');
  });
  ed.addEventListener('pointermove', e => {
    if (!rszTarget) return;
    const max = ed.clientWidth - 60;
    const w = Math.max(72, Math.min(max, rszStart.w + (e.clientX - rszStart.x)));
    rszTarget.style.width = Math.round(w) + 'px';
  });
  const endRsz = () => {
    if (!rszTarget) return;
    rszTarget.classList.remove('resizing');
    rszTarget = null;
    markDirty();
  };
  ed.addEventListener('pointerup', endRsz);
  ed.addEventListener('pointercancel', endRsz);
  // double-click a preview to cycle small / medium / full width
  ed.addEventListener('dblclick', e => {
    const fig = e.target.closest('.media');
    if (!fig) return;
    e.preventDefault();
    const steps = [96, 160, 294, 440, Math.max(294, ed.clientWidth - 60)];
    const cur = fig.getBoundingClientRect().width;
    const next = steps.find(s => s > cur + 8) || steps[0];
    fig.style.width = Math.round(next) + 'px';
    markDirty();
  });
}

/* pointer-driven drag: pick a preview up and drop it into the text.
   HTML5 drag never fired reliably inside contenteditable, so the mouse-up
   landed as a plain click and opened the link instead of moving the card. */
let dragCard = null, dragFrom = null, dragMoved = false, dragBlockClick = 0;
function pointRange(x, y) {
  let range = null;
  if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
  else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); }
  }
  return range;
}
function showDropMark(x, y) {
  ed.querySelectorAll('.dropMark').forEach(m => m.remove());
  const r = pointRange(x, y);
  if (!r || !ed.contains(r.startContainer) || dragCard.contains(r.startContainer)) return null;
  r.collapse(true);
  const mark = document.createElement('span');
  mark.className = 'dropMark';
  mark.setAttribute('contenteditable', 'false');
  r.insertNode(mark);
  return mark;
}
function initCardDrag() {
  ed.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.lcard')) e.preventDefault(); });

  ed.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.rsz')) return;
    const c = e.target.closest('.lcard');
    if (!c) return;
    dragCard = c; dragMoved = false;
    dragFrom = { x: e.clientX, y: e.clientY };
    try { ed.setPointerCapture(e.pointerId); } catch (err) {}
  });

  ed.addEventListener('pointermove', e => {
    if (!dragCard || !dragFrom) return;
    if (Math.abs(e.clientX - dragFrom.x) <= 5 && Math.abs(e.clientY - dragFrom.y) <= 5) return;
    if (!dragMoved) { dragMoved = true; dragCard.classList.add('dragging'); ed.classList.add('dropping'); }
    showDropMark(e.clientX, e.clientY);
  });

  const endDrag = () => {
    if (!dragCard) return;
    const card = dragCard, moved = dragMoved;
    dragCard = null; dragFrom = null; dragMoved = false;
    card.classList.remove('dragging');
    ed.classList.remove('dropping');
    const mark = ed.querySelector('.dropMark');
    if (moved && mark) {
      dragBlockClick = Date.now();
      mark.parentNode.insertBefore(card, mark);
      mark.remove();
      hydrateCards();
      const after = card.nextSibling;
      if (after && after.nodeType === 3) {
        const r = document.createRange();
        r.setStart(after, Math.min(1, after.nodeValue.length)); r.collapse(true);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      markDirty(); updateStatus();
      toast('Preview moved');
    }
    ed.querySelectorAll('.dropMark').forEach(m => m.remove());
  };
  ed.addEventListener('pointerup', endDrag);
  ed.addEventListener('pointercancel', endDrag);
}

function insertCardFor(url) {
  const cardHtml = linkCard(esc(url));
  if (!cardHtml) return false;
  document.execCommand('insertHTML', false, cardHtml + '&nbsp;');
  hydrateCards();
  return true;
}

/* Single preferences record. Every save overwrites this one key, so nothing
   accumulates in storage. Legacy keys are cleared once on boot. */
const STORE = 'hypad';
const LEGACY = ['hybrid_scratchpad_v1'];
const MAX_VERSIONS = 25;

let st = { v: 2, tabs: [], active: null, sidebar: true, zoom: 100, onTop: true, histMin: true };
let saveTimer = null, verTimer = null, writing = false, pending = false;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();
const active = () => st.tabs.find(t => t.id === st.active);

function newTab(o = {}) {
  return { id: uid(), title: o.title || 'Untitled', text: o.text || '', path: o.path || null,
    named: !!o.named, pinned: false, dirty: false, updated: nowISO(), versions: [], sel: 0 };
}

/* ---------- persistence: one key, serialized writes ---------- */
async function persist() {
  if (writing) { pending = true; return; }        // never overlap writes
  writing = true;
  try {
    await Neutralino.storage.setData(STORE, JSON.stringify(st));
    $('savedDot').className = 'saved';
  } catch (e) {
  } finally {
    writing = false;
    if (pending) { pending = false; persist(); }
  }
}
function queueSave() {
  $('savedDot').className = 'dirty';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 350);
}
async function restore() {
  try {
    const p = JSON.parse(await Neutralino.storage.getData(STORE));
    if (p && Array.isArray(p.tabs) && p.tabs.length) st = Object.assign(st, p);
  } catch (e) {}
  // drop stale records from earlier versions so storage stays clean
  for (const k of LEGACY) { try { await Neutralino.storage.setData(k); } catch (e) {} }
  if (!st.tabs.length) st.tabs = [newTab()];
  if (!active()) st.active = st.tabs[0].id;
}

function snapshot() {
  const t = active(); if (!t) return;
  if (t.versions[0] && t.versions[0].text === t.text) return;
  t.versions.unshift({ at: nowISO(), text: t.text });
  if (t.versions.length > MAX_VERSIONS) t.versions.length = MAX_VERSIONS;
}

const icon = n => `<svg class="gl"><use href="#i-${n}"/></svg>`;

/* ---------- tabs ---------- */
function renderTabs() {
  const box = $('tabs'); box.innerHTML = '';
  for (const t of st.tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (t.id === st.active ? ' active' : '');
    el.title = 'Double-click to rename';
    el.innerHTML = `<span class="tt"></span>${t.dirty ? '<span class="dot"></span>' : ''}<button class="x" title="Close (Ctrl+W)">${icon('close')}</button>`;
    el.querySelector('.tt').textContent = t.title;
    el.onclick = e => { if (!e.target.closest('.x')) switchTab(t.id); };
    el.ondblclick = e => { if (!e.target.closest('.x')) startRename(t, el.querySelector('.tt')); };
    el.querySelector('.x').onclick = e => { e.stopPropagation(); closeTab(t.id); };
    box.appendChild(el);
  }
}

/* ---------- rename (tab or sidebar row) ---------- */
function startRename(t, labelEl) {
  if (!labelEl || labelEl.querySelector('input')) return;
  const input = document.createElement('input');
  input.className = 'renameBox';
  input.value = t.title;
  input.spellcheck = false;
  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus(); input.select();
  const commit = ok => {
    const v = input.value.trim();
    if (ok && v) { t.title = v.slice(0, 60); t.named = true; t.updated = nowISO(); queueSave(); }
    renderTabs(); renderNotes(); updateStatus();
  };
  input.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); commit(true); }
    if (e.key === 'Escape') { e.preventDefault(); commit(false); }
  };
  input.onblur = () => commit(true);
  input.onclick = e => e.stopPropagation();
  input.ondblclick = e => e.stopPropagation();
}

/* ---------- sidebar ---------- */
function renderNotes() {
  const q = $('noteSearch').value.trim().toLowerCase();
  const box = $('noteList'); box.innerHTML = '';
  const list = st.tabs
    .filter(t => !q || t.title.toLowerCase().includes(q) || t.text.toLowerCase().includes(q))
    .slice().sort((a, b) => (b.pinned - a.pinned) || (a.updated < b.updated ? 1 : -1));

  if (!list.length) {
    box.innerHTML = `<div class="empty">No notes match</div>`;
    return;
  }
  for (const t of list) {
    const el = document.createElement('div');
    el.className = 'note' + (t.id === st.active ? ' active' : '') + (t.pinned ? ' isPinned' : '');
    el.innerHTML =
      `<span class="nt"></span>
       <button class="act pin" title="${t.pinned ? 'Unpin note' : 'Pin note'}">${icon('pin')}</button>
       <button class="act ren" title="Rename note (F2)">${icon('rename')}</button>
       <button class="act del" title="Delete note">${icon('trash')}</button>`;
    el.querySelector('.nt').textContent = t.title;
    el.onclick = e => { if (!e.target.closest('.act')) switchTab(t.id); };
    el.ondblclick = e => { if (!e.target.closest('.act')) startRename(t, el.querySelector('.nt')); };
    el.querySelector('.pin').onclick = e => {
      e.stopPropagation(); t.pinned = !t.pinned;
      renderNotes(); queueSave(); toast(t.pinned ? 'Pinned' : 'Unpinned');
    };
    el.querySelector('.ren').onclick = e => { e.stopPropagation(); startRename(t, el.querySelector('.nt')); };
    el.querySelector('.del').onclick = e => { e.stopPropagation(); closeTab(t.id); };
    box.appendChild(el);
  }
}

function renderHistory() {
  const t = active(); const box = $('histList'); box.innerHTML = '';
  if (!t || !t.versions.length) { box.innerHTML = '<div class="empty">No versions yet</div>'; return; }
  t.versions.forEach(v => {
    const el = document.createElement('div');
    el.className = 'hrow';
    el.innerHTML = `<span class="hw"></span><small>${v.text.trim().split(/\s+/).filter(Boolean).length}w</small>`;
    el.querySelector('.hw').textContent = new Date(v.at).toLocaleString();
    el.title = 'Restore this version';
    el.onclick = () => {
      snapshot(); t.text = v.text; setDocFromMd(v.text); t.html = ed.innerHTML;
      markDirty(); updateStatus(); renderHistory(); toast('Version restored');
    };
    box.appendChild(el);
  });
}

function updateStatus() {
  const v = plainText();
  $('stCount').textContent = `${v.trim() ? v.trim().split(/\s+/).length : 0} words \u00b7 ${v.length} characters`;
  const upto = v.slice(0, ed.selectionStart).split('\n');
  $('stPos').textContent = `Ln ${upto.length}, Col ${upto[upto.length - 1].length + 1}`;
  const t = active();
  $('stFile').textContent = t ? (t.path || 'Unsaved note') : '';
  $('stZoom').textContent = st.zoom + '%';
}

const titleFrom = text => {
  const l = text.split('\n').find(x => x.trim());
  return l ? l.replace(/^#{1,6}\s*/, '').trim().slice(0, 40) : 'Untitled';
};

function markDirty() {
  const t = active(); if (!t) return;
  t.text = ed.value;
  t.html = ed.innerHTML;
  t.dirty = true;
  t.updated = nowISO();
  if (!t.path && !t.named) t.title = titleFrom(t.text);   // manual names win
  renderTabs(); renderNotes(); queueSave();
  clearTimeout(verTimer);
  verTimer = setTimeout(() => { snapshot(); persist(); }, 8000);
}

function switchTab(id) {
  const cur = active(); if (cur) cur.sel = ed.selectionStart;
  st.active = id;
  const t = active(); if (!t) return;
  if (t.html) { ed.innerHTML = t.html; hydrateCards(); } else setDocFromMd(t.text);
  ed.focus();
  ed.setSelectionRange(t.sel || 0, t.sel || 0);
  renderTabs(); renderNotes(); updateStatus(); queueSave();
  if (!$('preview').hidden) doPreview(true);
  if (!$('history').hidden) renderHistory();
}
const addTab = () => { const t = newTab(); st.tabs.push(t); switchTab(t.id); };
function closeTab(id) {
  const i = st.tabs.findIndex(t => t.id === id); if (i < 0) return;
  st.tabs.splice(i, 1);
  if (!st.tabs.length) st.tabs.push(newTab());
  if (st.active === id) switchTab(st.tabs[Math.max(0, i - 1)].id);
  else { renderTabs(); renderNotes(); queueSave(); }
}

/* ---------- formatting commands (native, so undo/redo just works) ---------- */
function typeIn(text, from, to) {
  ed.focus();
  if (from !== undefined) ed.setSelectionRange(from, to === undefined ? from : to);
  try { document.execCommand('insertText', false, text); } catch (e) {}
}
/* remember the selection so a toolbar click always formats the text
   the user had highlighted, exactly like a word processor */
let lastRange = null;
function rememberSelection() {
  const s = window.getSelection();
  if (s && s.rangeCount && ed.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange();
}
function restoreSelection() {
  ed.focus();
  const s = window.getSelection();
  // a live caret or selection inside the editor always wins over the saved one
  if (s && s.rangeCount && ed.contains(s.anchorNode)) return;
  if (!lastRange || !ed.contains(lastRange.commonAncestorContainer)) return;
  s.removeAllRanges(); s.addRange(lastRange);
}
try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
const cmd = (name, val) => {
  restoreSelection();
  document.execCommand(name, false, val);
  rememberSelection();
  markDirty(); updateStatus(); syncToolbar();
};

/* reflect the state of the caret in the toolbar (bold looks pressed, etc.) */
function syncToolbar() {
  const states = { bold: 'bold', italic: 'italic', strike: 'strikeThrough' };
  for (const key in states) {
    const b = document.querySelector('#toolbar [data-md="' + key + '"]');
    if (!b) continue;
    let on = false;
    try { on = document.queryCommandState(states[key]); } catch (e) {}
    b.classList.toggle('on', on);
  }
  let node = window.getSelection() && window.getSelection().anchorNode;
  while (node && node !== ed && !(node.tagName && /^(H1|H2|H3|BLOCKQUOTE|LI|CODE)$/.test(node.tagName))) node = node.parentNode;
  const tag = node && node.tagName ? node.tagName.toLowerCase() : '';
  [['h1', 'h1'], ['h2', 'h2'], ['h3', 'h3'], ['quote', 'blockquote'], ['code', 'code']].forEach(([k, t]) => {
    const b = document.querySelector('#toolbar [data-md="' + k + '"]');
    if (b) b.classList.toggle('on', tag === t);
  });
}
function toggleBlock(tag) {
  restoreSelection();
  const sel = window.getSelection();
  let node = sel.anchorNode;
  while (node && node !== ed && (!node.tagName || !/^(H[1-6]|P|DIV|BLOCKQUOTE|LI)$/.test(node.tagName))) node = node.parentNode;
  const cur = node && node.tagName ? node.tagName.toLowerCase() : '';
  document.execCommand('formatBlock', false, cur === tag ? 'div' : tag);
  rememberSelection();
  markDirty(); updateStatus(); syncToolbar();
}
function wrapSel(pre, post) {   // kept for Tab and programmatic edits
  typeIn(pre + (post ? '' : ''), ed.selectionStart, ed.selectionEnd);
  markDirty(); updateStatus();
}
function inlineCode() {
  restoreSelection();
  const sel = window.getSelection();
  const text = sel ? sel.toString() : '';
  document.execCommand('insertHTML', false, '<code>' + (esc(text) || '&nbsp;') + '</code>&nbsp;');
  markDirty(); updateStatus();
}
const MD = {
  h1: () => toggleBlock('h1'), h2: () => toggleBlock('h2'), h3: () => toggleBlock('h3'),
  bold: () => cmd('bold'), italic: () => cmd('italic'), strike: () => cmd('strikeThrough'),
  code: inlineCode,
  ul: () => cmd('insertUnorderedList'), ol: () => cmd('insertOrderedList'),
  task: () => { ed.focus(); document.execCommand('insertHTML', false, '<div>\u2610 </div>'); markDirty(); },
  quote: () => toggleBlock('blockquote'),
  hr: () => { ed.focus(); document.execCommand('insertHTML', false, '<hr /><div><br></div>'); markDirty(); }
};

/* ---------- Markdown typed inline turns into real formatting ---------- */
function autoFormat() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== 3) return;
  const txt = node.nodeValue, off = sel.anchorOffset;
  const before = txt.slice(0, off);

  // block level: "# ", "## ", "### ", "> ", "- ", "1. " at the start of a line
  const bm = before.match(/^(#{1,3}|>|-|\*|\d+\.)\u0020$/);
  if (bm) {
    const tag = bm[1][0] === '#' ? 'h' + bm[1].length : bm[1] === '>' ? 'blockquote' : null;
    node.nodeValue = txt.slice(off);
    ed.setSelectionRange(caretOffset('start'));
    if (tag) document.execCommand('formatBlock', false, tag);
    else if (bm[1] === '-' || bm[1] === '*') document.execCommand('insertUnorderedList');
    else document.execCommand('insertOrderedList');
    return;
  }
  // inline level: **bold**, *italic*, ~~strike~~, `code`
  const pairs = [[/\*\*([^*]+)\*\*$/, 'bold'], [/(?:^|[^*])\*([^*]+)\*$/, 'italic'],
                 [/~~([^~]+)~~$/, 'strikeThrough'], [/`([^`]+)`$/, 'code']];
  for (const [rx, action] of pairs) {
    const m = before.match(rx);
    if (!m) continue;
    const inner = m[1];
    const full = m[0].startsWith('*') || m[0].startsWith('~') || m[0].startsWith('`') ? m[0] : m[0].slice(1);
    const start = off - full.length;
    const r = document.createRange();
    r.setStart(node, start); r.setEnd(node, off);
    const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r);
    if (action === 'code') document.execCommand('insertHTML', false, '<code>' + esc(inner) + '</code>');
    else { document.execCommand('insertText', false, inner);
      const e2 = caretOffset('start'); ed.setSelectionRange(e2 - inner.length, e2);
      document.execCommand(action);
      ed.setSelectionRange(e2, e2);
      document.execCommand(action, false, null);
    }
    return;
  }
  // a finished URL becomes a link (plus a card for videos)
  const um = before.match(/(^|\s)(https?:\/\/[^\s]+)$/);
  if (um) {
    const url = um[2];
    const start = off - url.length;
    const r = document.createRange();
    r.setStart(node, start); r.setEnd(node, off);
    const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r);
    document.execCommand('insertHTML', false,
      '<a href="' + esc(url) + '">' + esc(url) + '</a>&nbsp;');
    const card = linkCard(esc(url));
    if (card && (/youtu\.be|youtube\.com|vimeo\.com/.test(url) || isImageUrl(url))) {
      document.execCommand('insertHTML', false, card + '&nbsp;');
      hydrateCards();
    }
  }
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
    // bare URLs become links, but never re-link one already inside an href
    .replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+)/g, (m, p, u) => p + '<a href="' + u + '">' + u + '</a>');
}

/* ---------- link cards ---------- */
const unesc = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function ytId(u) {
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(u) { const m = u.match(/vimeo\.com\/(\d+)/); return m ? m[1] : null; }
const IMG_RX = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;
function isImageUrl(u) {
  return IMG_RX.test(u) || /(images\.unsplash\.com|i\.imgur\.com|pbs\.twimg\.com\/media|cdn\.discordapp\.com\/attachments)/i.test(u);
}
function linkCard(raw) {
  const u = unesc(raw);
  let host = '';
  try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return null; }
  const y = ytId(u), v = vimeoId(u), isImg = isImageUrl(u);

  // a link to an image previews the image itself
  if (isImg) {
    return '<figure class="lcard media img" contenteditable="false" data-url="' + raw + '" style="width:294px">' +
      '<img class="mimg" src="' + raw + '" alt="" loading="lazy" />' +
      '<span class="rsz" title="Drag to resize"></span>' +
      '<figcaption class="lh">' + esc(host) + '</figcaption></figure>';
  }

  // a link to a video previews its thumbnail
  let thumb = '';
  if (y) thumb = 'https://i.ytimg.com/vi/' + y + '/hqdefault.jpg';
  else if (v) thumb = 'https://vumbnail.com/' + v + '.jpg';
  if (thumb) {
    return '<figure class="lcard media wide" contenteditable="false" data-url="' + raw + '" style="width:294px">' +
      '<span class="lthumb"><img src="' + thumb + '" alt="" loading="lazy" /><span class="lplay"></span></span>' +
      '<span class="lmeta"><span class="lt">' + esc(host === 'youtu.be' ? 'YouTube video' : host) + '</span>' +
      '<span class="lh">' + esc(u.slice(0, 90)) + '</span></span>' +
      '<span class="rsz" title="Drag to resize"></span></figure>';
  }

  // anything else: a compact site card
  let path = '';
  try { path = decodeURIComponent(new URL(u).pathname).replace(/^\/|\/$/g, '') || host; } catch (e) { path = host; }
  const fav = 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(host);
  return '<a class="lcard" contenteditable="false" data-url="' + raw + '" href="' + raw + '">' +
    '<span class="lfav"><img src="' + fav + '" alt="" loading="lazy" /></span>' +
    '<span class="lmeta"><span class="lt">' + esc(path.slice(0, 120)) + '</span>' +
    '<span class="lh">' + esc(host) + '</span></span></a>';
}
function mdToHtml(src) {
  return esc(src).split(/\n{2,}/).map(b => {
    const t = b.trim(); if (!t) return '';
    if (/^```/.test(t)) return `<pre><code>${t.replace(/^```\w*\n?|```$/g, '')}</code></pre>`;
    if (/^(---|\*\*\*)$/.test(t)) return '<hr />';
    if (/^https?:\/\/\S+$/.test(t)) { const c = linkCard(t); if (c) return c; }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    if (/^&gt;\s/.test(t)) return `<blockquote>${inline(t.replace(/^&gt;\s?/gm, ''))}</blockquote>`;
    if (/^[-*]\s\[[ x]\]\s/.test(t))
      return '<ul class="tl">' + t.split('\n').map(l => `<li><input type="checkbox" disabled ${/\[x\]/i.test(l) ? 'checked' : ''}/> ${inline(l.replace(/^[-*]\s\[[ x]\]\s/, ''))}</li>`).join('') + '</ul>';
    if (/^[-*]\s/.test(t)) return '<ul>' + t.split('\n').map(l => `<li>${inline(l.replace(/^[-*]\s/, ''))}</li>`).join('') + '</ul>';
    if (/^\d+\.\s/.test(t)) return '<ol>' + t.split('\n').map(l => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('') + '</ol>';
    return `<p>${inline(t).replace(/\n/g, '<br />')}</p>`;
  }).join('');
}
function doPreview(keep) {
  const p = $('preview');
  const show = keep ? true : p.hidden;
  p.hidden = !show;
  $('btnPreview').classList.toggle('on', show);
  if (show) { p.textContent = ed.value; p.className = 'srcView'; }
}

/* ---------- find & replace ---------- */
const msg = m => { $('findMsg').textContent = m; };
function findNext(dir) {
  const q = $('findInput').value; if (!q) return;
  ed.focus();
  const found = window.find(q, $('findCase').checked, dir < 0, $('findWrap').checked, false, false, false);
  if (!found) return msg('No results');
  const hay = $('findCase').checked ? plainText() : plainText().toLowerCase();
  const total = hay.split($('findCase').checked ? q : q.toLowerCase()).length - 1;
  msg(total + ' result' + (total === 1 ? '' : 's'));
  updateStatus();
}
function replaceOne() {
  const q = $('findInput').value; if (!q) return;
  const sel = window.getSelection().toString();
  const hit = $('findCase').checked ? sel === q : sel.toLowerCase() === q.toLowerCase();
  if (hit) { document.execCommand('insertText', false, $('replInput').value); markDirty(); }
  findNext(1);
}
function replaceAll() {
  const q = $('findInput').value; if (!q) return;
  ed.focus();
  const sel = window.getSelection(); sel.removeAllRanges();
  let n = 0;
  while (window.find(q, $('findCase').checked, false, false, false, false, false) && n < 5000) {
    document.execCommand('insertText', false, $('replInput').value);
    n++;
  }
  markDirty(); updateStatus(); msg('Replaced ' + n);
}
function toggleFind(force) {
  const b = $('findbar');
  b.hidden = force === true ? false : !b.hidden;
  $('btnFind').classList.toggle('on', !b.hidden);
  if (!b.hidden) {
    const s = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    if (s && s.length < 80) $('findInput').value = s;
    $('findInput').focus(); $('findInput').select();
  } else { msg(''); ed.focus(); }
}

/* ---------- files ---------- */
async function openFile() {
  try {
    const paths = await Neutralino.os.showOpenDialog('Open a text file', {
      multiSelections: true,
      filters: [
        { name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown', 'log', 'json', 'csv', 'ini', 'cfg', 'conf', 'html', 'htm'] },
        { name: 'Text document', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    if (!paths || !paths.length) return;
    for (const p of paths) {
      const text = await Neutralino.filesystem.readFile(p);
      const t = newTab({ text, path: p, title: p.split(/[\\/]/).pop(), named: true });
      st.tabs.push(t); switchTab(t.id);
    }
    toast('Opened');
  } catch (e) { toast('Could not open file'); }
}
// text -> bytes for the chosen container format
function htmlDoc(title, body) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />\n<title>' + esc(title) + '</title>\n' +
    '<style>body{max-width:44rem;margin:3rem auto;padding:0 1.25rem;' +
    'font:16px/1.7 -apple-system,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:#24292f}' +
    'pre,code{font-family:"Cascadia Code",Consolas,monospace;background:#f4f4f6;border-radius:4px}' +
    'pre{padding:.8rem;overflow:auto}code{padding:.1rem .3rem}' +
    'blockquote{margin:0;padding-left:1rem;border-left:3px solid #d0d7de;color:#57606a}' +
    'a{color:#0969da}hr{border:0;border-top:1px solid #d0d7de}img{max-width:100%}</style>\n' +
    '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
}
function csvDoc(text) {
  return 'line,content\n' + text.split(/\r?\n/).map((l, i) =>
    (i + 1) + ',"' + l.replace(/"/g, '""') + '"').join('\n') + '\n';
}
function encodeFor(path, t, text) {
  const ext = (path.match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
  if (ext === 'html' || ext === 'htm') return htmlDoc(t.title || 'Note', mdToHtml(text));
  if (ext === 'csv') return csvDoc(text);
  if (ext === 'json') return JSON.stringify({
    title: t.title || 'Note', savedAt: new Date().toISOString(),
    characters: text.length, words: (text.trim().match(/\S+/g) || []).length,
    text
  }, null, 2) + '\n';
  return text; // txt, md, markdown, log, ini, csv-less plain text, anything else
}
async function saveFile(saveAs) {
  const t = active(); if (!t) return;
  try {
    let p = t.path;
    if (!p || saveAs) {
      p = await Neutralino.os.showSaveDialog('Save note', {
        defaultPath: (t.title || 'note').replace(/\.[A-Za-z0-9]+$/, '').replace(/[\\/:*?"<>|]/g, '') + '.txt',
        filters: [
          { name: 'Text document', extensions: ['txt'] },
          { name: 'Markdown', extensions: ['md', 'markdown'] },
          { name: 'Web page', extensions: ['html', 'htm'] },
          { name: 'Rich note data', extensions: ['json'] },
          { name: 'Comma separated values', extensions: ['csv'] },
          { name: 'Log file', extensions: ['log'] },
          { name: 'Config file', extensions: ['ini', 'cfg', 'conf'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });
      if (!p) return;
      if (!/\.[A-Za-z0-9]+$/.test(p)) p += '.txt'; // default container is plain text
    }
    await Neutralino.filesystem.writeFile(p, encodeFor(p, t, ed.value));
    t.path = p; t.title = p.split(/[\\/]/).pop(); t.named = true; t.dirty = false;
    snapshot(); renderTabs(); renderNotes(); updateStatus(); persist();
    toast('Saved');
  } catch (e) { toast('Could not save file'); }
}

let toastTimer;
function toast(m) {
  const el = $('toast'); el.textContent = m; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 1500);
}

/* ---------- window: drag, resize edges, controls ---------- */
let winMaxed = false, preMax = null;

/* Borderless windows have no native maximize that respects the taskbar,
   so we snap to the monitor work area instead. */
async function pxScale() {
  try {
    const sz = await Neutralino.window.getSize();
    if (window.outerWidth > 0) {
      const r = sz.width / window.outerWidth;
      if (r > 0.2 && r < 5) return r;
    }
  } catch (e) {}
  return window.devicePixelRatio || 1;
}

async function isMaxed() {
  if (winMaxed) return true;
  try { return await Neutralino.window.isMaximized(); } catch (e) { return false; }
}

async function maximizeToWorkArea() {
  try {
    const p = await Neutralino.window.getPosition();
    const sz = await Neutralino.window.getSize();
    preMax = { x: p.x, y: p.y, w: sz.width, h: sz.height };
    const k = await pxScale();
    const sc = window.screen;
    const x = Math.round((sc.availLeft || 0) * k);
    const y = Math.round((sc.availTop || 0) * k);
    const w = Math.round(sc.availWidth * k);
    const h = Math.round(sc.availHeight * k);
    await Neutralino.window.move(x, y);
    await Neutralino.window.setSize({ width: w, height: h });
    winMaxed = true;
  } catch (e) {}
}

async function restoreWindow() {
  try {
    if (await Neutralino.window.isMaximized()) await Neutralino.window.unmaximize();
  } catch (e) {}
  try {
    if (preMax) {
      await Neutralino.window.setSize({ width: preMax.w, height: preMax.h });
      await Neutralino.window.move(preMax.x, preMax.y);
    }
  } catch (e) {}
  winMaxed = false;
}

async function syncMaxIcon() {
  try {
    const m = await isMaxed();
    $('maxUse').setAttribute('href', m ? '#i-restore' : '#i-max');
    document.body.classList.toggle('maximized', m);
  } catch (e) {}
}

function initWindow() {
  $('btnMin').onclick = () => Neutralino.window.minimize();
  $('btnMax').onclick = async () => {
    (await isMaxed()) ? await restoreWindow() : await maximizeToWorkArea();
    syncMaxIcon();
    setHistMin(st.histMin !== false);
  };
  $('btnClose').onclick = async () => { await persist(); Neutralino.app.exit(); };
  $('btnPinTop').onclick = async e => {
    st.onTop = !st.onTop;
    try { await Neutralino.window.setAlwaysOnTop(st.onTop); } catch (err) {}
    e.currentTarget.classList.toggle('on', st.onTop);
    toast(st.onTop ? 'Always on top' : 'Normal window');
    queueSave();
  };

  /* drag: track from the press origin against the window origin at press time */
  let dragOrigin = null;
  $('drag').addEventListener('pointerdown', async e => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    if (winMaxed) { winMaxed = false; preMax = null; syncMaxIcon(); }
    try {
      const p = await Neutralino.window.getPosition();
      dragOrigin = { sx: e.screenX, sy: e.screenY, wx: p.x, wy: p.y };
      $('drag').setPointerCapture(e.pointerId);
    } catch (err) {}
  });
  $('drag').addEventListener('pointermove', e => {
    if (!dragOrigin) return;
    Neutralino.window.move(
      dragOrigin.wx + (e.screenX - dragOrigin.sx),
      dragOrigin.wy + (e.screenY - dragOrigin.sy)
    ).catch(() => {});
  });
  const endDrag = () => { dragOrigin = null; };
  $('drag').addEventListener('pointerup', endDrag);
  $('drag').addEventListener('pointercancel', endDrag);
  $('drag').addEventListener('dblclick', () => $('btnMax').click());

  /* resize: 8 edge/corner zones, absolute geometry from the press origin */
  const MIN_W = 420, MIN_H = 280;
  document.querySelectorAll('.rz').forEach(zone => {
    const dir = zone.dataset.rz;
    let o = null;
    zone.addEventListener('pointerdown', async e => {
      e.preventDefault();
      if (winMaxed) { winMaxed = false; preMax = null; syncMaxIcon(); }
      try {
        const p = await Neutralino.window.getPosition();
        const s = await Neutralino.window.getSize();
        o = { sx: e.screenX, sy: e.screenY, x: p.x, y: p.y, w: s.width, h: s.height };
        zone.setPointerCapture(e.pointerId);
      } catch (err) {}
    });
    zone.addEventListener('pointermove', e => {
      if (!o) return;
      const dx = e.screenX - o.sx, dy = e.screenY - o.sy;
      let { x, y, w, h } = o;
      if (dir.includes('e')) w = Math.max(MIN_W, o.w + dx);
      if (dir.includes('s')) h = Math.max(MIN_H, o.h + dy);
      if (dir.includes('w')) { w = Math.max(MIN_W, o.w - dx); x = o.x + (o.w - w); }
      if (dir.includes('n')) { h = Math.max(MIN_H, o.h - dy); y = o.y + (o.h - h); }
      Neutralino.window.setSize({ width: w, height: h }).catch(() => {});
      if (x !== o.x || y !== o.y) Neutralino.window.move(x, y).catch(() => {});
    });
    const end = () => { o = null; };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  });

  Neutralino.events.on('windowClose', async () => { await persist(); Neutralino.app.exit(); });
  Neutralino.events.on('windowMaximize', syncMaxIcon);
  Neutralino.events.on('windowUnmaximize', syncMaxIcon);
  Neutralino.events.on('filesDropped', async ev => {
    for (const p of (ev.detail && ev.detail.files ? ev.detail.files : [])) {
      try {
        const text = await Neutralino.filesystem.readFile(p);
        const t = newTab({ text, path: p, title: p.split(/[\\/]/).pop(), named: true });
        st.tabs.push(t); switchTab(t.id);
      } catch (err) {}
    }
  });
}

function setZoom(z) {
  st.zoom = Math.min(300, Math.max(50, z));
  document.documentElement.style.setProperty('--fs', (15 * st.zoom / 100).toFixed(2) + 'px');
  updateStatus(); queueSave();
}

/* ---------- wiring ---------- */
function wire() {
  ed.addEventListener('input', () => {
    autoFormat();
    markDirty(); updateStatus();
    if (!$('preview').hidden) doPreview(true);
  });
  ed.addEventListener('keyup', () => { updateStatus(); rememberSelection(); syncToolbar(); });
  ed.addEventListener('mouseup', () => { rememberSelection(); syncToolbar(); });
  ed.addEventListener('click', updateStatus);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === ed) { rememberSelection(); syncToolbar(); }
  });
  ed.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
    }
  });
  // paste as clean text; a pasted URL becomes a link (and a card for videos)
  ed.addEventListener('paste', e => {
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    e.preventDefault();
    const url = text.trim();
    if (/^https?:\/\/\S+$/.test(url)) {
      document.execCommand('insertHTML', false, '<a href="' + esc(url) + '">' + esc(url) + '</a>');
      const c = linkCard(esc(url));
      if (c) { document.execCommand('insertHTML', false, c + '&nbsp;'); hydrateCards(); }
    } else {
      document.execCommand('insertText', false, text);
    }
    markDirty(); updateStatus();
  });
  // Ctrl+click or click on a card opens the link in the browser
  ed.addEventListener('click', async e => {
    if (Date.now() - dragBlockClick < 400) return;
    const card = e.target.closest('.lcard');
    const a = e.target.closest('a[href^="http"]');
    const url = card ? card.dataset.url : (a && (e.ctrlKey || e.metaKey) ? a.getAttribute('href') : null);
    if (!url) return;
    e.preventDefault();
    try { await Neutralino.os.open(url); } catch (err) { toast('Could not open link'); }
  });
  document.querySelectorAll('#toolbar [data-md]').forEach(b => {
    b.addEventListener('mousedown', e => e.preventDefault()); // keep the highlighted text selected
    b.onclick = () => { MD[b.dataset.md](); syncToolbar(); };
  });
  $('btnNewTab').onclick = addTab;
  $('btnSidebar').onclick = () => {
    st.sidebar = !st.sidebar;
    $('sidebar').classList.toggle('hidden', !st.sidebar);
    $('btnSidebar').classList.toggle('on', st.sidebar);
    queueSave();
  };
  $('noteSearch').oninput = renderNotes;
  $('btnFind').onclick = () => toggleFind();
  $('findClose').onclick = () => toggleFind();
  $('findNext').onclick = () => findNext(1);
  $('findPrev').onclick = () => findNext(-1);
  $('replOne').onclick = replaceOne;
  $('replAll').onclick = replaceAll;
  $('findInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') toggleFind();
  });
  $('preview').addEventListener('click', async e => {
    const a = e.target.closest('a[href^="http"]');
    if (!a) return;
    e.preventDefault();
    try { await Neutralino.os.open(a.getAttribute('href')); } catch (err) { toast('Could not open link'); }
  });
  $('btnPreview').onclick = () => doPreview();
  function syncHistPad() {
    const h = $('history');
    $('editorWrap').classList.toggle('histOpen', !h.hidden && !h.classList.contains('min'));
    $('editorWrap').classList.toggle('histBar', !h.hidden && h.classList.contains('min'));
  }
  $('btnHistory').onclick = () => {
    const h = $('history');
    h.hidden = !h.hidden;
    $('btnHistory').classList.toggle('on', !h.hidden);
    if (!h.hidden) renderHistory();
    syncHistPad();
  };
  // the panel is closed from the History toolbar button; the rail handles collapsing
  const setHistMin = (min) => {
    st.histMin = min;
    $('history').classList.toggle('min', min);
    $('histMinUse').setAttribute('href', '#i-panel');
    $('histMin').title = min ? 'Expand history' : 'Minimize history';
    syncHistPad();
  };
  $('histMin').onclick = () => { setHistMin(!$('history').classList.contains('min')); queueSave(); };
  $('btnOpen').onclick = openFile;
  $('btnSave').onclick = () => saveFile(false);
  $('btnSave').addEventListener('contextmenu', e => { e.preventDefault(); saveFile(true); });

  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      const t = active();
      const row = document.querySelector('.note.active .nt') || document.querySelector('.tab.active .tt');
      if (t && row) { e.preventDefault(); startRename(t, row); }
      return;
    }
    const c = e.ctrlKey || e.metaKey;
    if (!c) { if (e.key === 'Escape' && !$('findbar').hidden) toggleFind(); return; }
    const k = e.key.toLowerCase();
    if (k === 'tab') {
      e.preventDefault();
      const i = st.tabs.findIndex(t => t.id === st.active);
      switchTab(st.tabs[(i + (e.shiftKey ? -1 : 1) + st.tabs.length) % st.tabs.length].id);
      return;
    }
    const map = {
      n: addTab, t: addTab, w: () => closeTab(st.active),
      s: () => saveFile(e.shiftKey), o: openFile,
      f: () => toggleFind(true), h: () => $('btnHistory').click(),
      p: () => doPreview(),
      '\\': () => $('btnSidebar').click(),
      d: () => { snapshot(); persist(); toast('Snapshot saved'); },
      '0': () => setZoom(100), '=': () => setZoom(st.zoom + 10),
      '+': () => setZoom(st.zoom + 10), '-': () => setZoom(st.zoom - 10)
    };
    if (map[k]) { e.preventDefault(); map[k](); }
  });
}

/* ---------- boot ---------- */
(async () => {
  await restore();
  initWindow();
  wire();
  initResize();
  initCardDrag();
  $('sidebar').classList.toggle('hidden', !st.sidebar);
  $('btnSidebar').classList.toggle('on', st.sidebar);
  $('btnPinTop').classList.toggle('on', st.onTop);
  try { await Neutralino.window.setAlwaysOnTop(!!st.onTop); } catch (e) {}
  setZoom(st.zoom);
  switchTab(st.active);
  syncMaxIcon();
  // opening animation: reveal only once everything is painted
  requestAnimationFrame(() => document.body.classList.add('ready'));
  ed.focus();
})();
})();
