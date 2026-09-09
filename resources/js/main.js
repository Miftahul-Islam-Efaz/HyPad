/* HyPad - floating scratchpad + Notepad hybrid */
(() => {
'use strict';
Neutralino.init();

const $ = id => document.getElementById(id);
const ed = $('editor');

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
      snapshot(); t.text = v.text; ed.value = v.text;
      markDirty(); updateStatus(); renderHistory(); toast('Version restored');
    };
    box.appendChild(el);
  });
}

function updateStatus() {
  const v = ed.value;
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
  ed.value = t.text;
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

/* ---------- markdown ---------- */
function wrapSel(pre, post) {
  const s = ed.selectionStart, e = ed.selectionEnd, v = ed.value;
  ed.value = v.slice(0, s) + pre + v.slice(s, e) + post + v.slice(e);
  ed.focus(); ed.setSelectionRange(s + pre.length, e + pre.length);
  markDirty(); updateStatus();
}
function linePrefix(prefix, numbered) {
  const v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
  const a = v.lastIndexOf('\n', s - 1) + 1;
  let b = v.indexOf('\n', e); if (b < 0) b = v.length;
  const rx = /^(\s*)(?:[-*]\s\[[ x]\]\s|[-*]\s|\d+\.\s|>\s|#{1,6}\s)?/;
  const out = v.slice(a, b).split('\n').map((ln, i) => ln.replace(rx, (m, w) => w + (numbered ? (i + 1) + '. ' : prefix)));
  ed.value = v.slice(0, a) + out.join('\n') + v.slice(b);
  ed.focus(); ed.setSelectionRange(a, a + out.join('\n').length);
  markDirty(); updateStatus();
}
const MD = {
  h1: () => linePrefix('# '), h2: () => linePrefix('## '), h3: () => linePrefix('### '),
  bold: () => wrapSel('**', '**'), italic: () => wrapSel('*', '*'),
  strike: () => wrapSel('~~', '~~'), code: () => wrapSel('`', '`'),
  ul: () => linePrefix('- '), ol: () => linePrefix('', true),
  task: () => linePrefix('- [ ] '), quote: () => linePrefix('> '),
  hr: () => wrapSel('\n\n---\n\n', '')
};

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}
function mdToHtml(src) {
  return esc(src).split(/\n{2,}/).map(b => {
    const t = b.trim(); if (!t) return '';
    if (/^```/.test(t)) return `<pre><code>${t.replace(/^```\w*\n?|```$/g, '')}</code></pre>`;
    if (/^(---|\*\*\*)$/.test(t)) return '<hr />';
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
  if (show) p.innerHTML = mdToHtml(ed.value);
}

/* ---------- find & replace ---------- */
const msg = m => { $('findMsg').textContent = m; };
function findNext(dir) {
  const q = $('findInput').value; if (!q) return;
  const cs = $('findCase').checked, wrap = $('findWrap').checked;
  const hay = cs ? ed.value : ed.value.toLowerCase();
  const needle = cs ? q : q.toLowerCase();
  let i;
  if (dir > 0) {
    i = hay.indexOf(needle, ed.selectionEnd);
    if (i < 0) { if (!wrap) return msg('End of document reached'); i = hay.indexOf(needle); }
  } else {
    i = hay.lastIndexOf(needle, Math.max(0, ed.selectionStart - 1));
    if (i < 0) { if (!wrap) return msg('Beginning of document reached'); i = hay.lastIndexOf(needle); }
  }
  if (i < 0) return msg('No results');
  ed.focus(); ed.setSelectionRange(i, i + q.length);
  const total = hay.split(needle).length - 1;
  msg(`${total} result${total === 1 ? '' : 's'}`);
  updateStatus();
}
function replaceOne() {
  const q = $('findInput').value; if (!q) return;
  const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
  const hit = $('findCase').checked ? sel === q : sel.toLowerCase() === q.toLowerCase();
  if (hit) {
    const s = ed.selectionStart, r = $('replInput').value;
    ed.value = ed.value.slice(0, s) + r + ed.value.slice(ed.selectionEnd);
    ed.setSelectionRange(s + r.length, s + r.length);
    markDirty();
  }
  findNext(1);
}
function replaceAll() {
  const q = $('findInput').value; if (!q) return;
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('findCase').checked ? 'g' : 'gi');
  const n = (ed.value.match(rx) || []).length;
  ed.value = ed.value.replace(rx, $('replInput').value);
  markDirty(); updateStatus(); msg(`Replaced ${n}`);
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
      filters: [{ name: 'Text and Markdown', extensions: ['txt', 'md', 'markdown', 'log', 'json', 'csv'] },
                { name: 'All files', extensions: ['*'] }]
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
async function saveFile(saveAs) {
  const t = active(); if (!t) return;
  try {
    let p = t.path;
    if (!p || saveAs) {
      p = await Neutralino.os.showSaveDialog('Save note', {
        defaultPath: (t.title || 'note').replace(/[\\/:*?"<>|]/g, '') + '.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
      });
      if (!p) return;
    }
    await Neutralino.filesystem.writeFile(p, ed.value);
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
async function syncMaxIcon() {
  try {
    const m = await Neutralino.window.isMaximized();
    $('maxUse').setAttribute('href', m ? '#i-down' : '#i-max');
    document.body.classList.toggle('maximized', m);
  } catch (e) {}
}

function initWindow() {
  $('btnMin').onclick = () => Neutralino.window.minimize();
  $('btnMax').onclick = async () => {
    try {
      (await Neutralino.window.isMaximized())
        ? await Neutralino.window.unmaximize()
        : await Neutralino.window.maximize();
    } catch (e) {}
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
  ed.addEventListener('input', () => { markDirty(); updateStatus(); if (!$('preview').hidden) doPreview(true); });
  ed.addEventListener('keyup', updateStatus);
  ed.addEventListener('click', updateStatus);
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const s = ed.selectionStart, v = ed.value;
      const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
      const m = line.match(/^(\s*)([-*]\s\[[ x]\]\s|[-*]\s|(\d+)\.\s)/);
      if (m) {
        e.preventDefault();
        if (line.trim() === m[0].trim()) {
          const a = v.lastIndexOf('\n', s - 1) + 1;
          ed.value = v.slice(0, a) + v.slice(s); ed.setSelectionRange(a, a);
        } else {
          const next = m[3] ? m[1] + (parseInt(m[3], 10) + 1) + '. ' : m[1] + m[2].replace(/\[x\]/i, '[ ]');
          ed.value = v.slice(0, s) + '\n' + next + v.slice(s);
          ed.setSelectionRange(s + 1 + next.length, s + 1 + next.length);
        }
        markDirty(); updateStatus();
      }
    }
    if (e.key === 'Tab') { e.preventDefault(); wrapSel('\t', ''); }
  });

  document.querySelectorAll('#toolbar [data-md]').forEach(b => b.onclick = () => MD[b.dataset.md]());
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
  $('btnPreview').onclick = () => doPreview();
  $('btnHistory').onclick = () => {
    const h = $('history');
    h.hidden = !h.hidden;
    $('btnHistory').classList.toggle('on', !h.hidden);
    if (!h.hidden) renderHistory();
  };
  $('histClose').onclick = () => { $('history').hidden = true; $('btnHistory').classList.remove('on'); };
  const setHistMin = (min) => {
    st.histMin = min;
    $('history').classList.toggle('min', min);
    $('histMinUse').setAttribute('href', min ? '#i-down' : '#i-up');
    $('histMin').title = min ? 'Expand history' : 'Minimize history';
  };
  $('histMin').onclick = () => { setHistMin(!$('history').classList.contains('min')); queueSave(); };
  $('btnOpen').onclick = openFile;
  $('btnSave').onclick = () => saveFile(false);

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
      p: () => doPreview(), b: () => $('btnSidebar').click(),
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
