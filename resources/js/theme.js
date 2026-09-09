/* HyPad theme controller: palette picker + persisted preference (single record) */
(() => {
  'use strict';
  const PREF = 'hypad_prefs';          // one key, overwritten every time
  const LEGACY_LS = ['hybrid_scratchpad_theme', 'hypad_theme'];
  const root = document.documentElement;
  const btn = document.getElementById('btnTheme');

  const THEMES = [
    { id: 'latte',    name: 'Latte',    dark: false, c: ['#eff1f5', '#7287fd', '#40a02b'] },
    { id: 'paper',    name: 'Paper',    dark: false, c: ['#f3ead3', '#8da101', '#35a77c'] },
    { id: 'dawn',     name: 'Dawn',     dark: false, c: ['#faf4ed', '#907aa9', '#56949f'] },
    { id: 'midnight', name: 'Midnight', dark: true,  c: ['#232136', '#c4a7e7', '#9ccfd8'] },
    { id: 'forest',   name: 'Forest',   dark: true,  c: ['#333c43', '#a7c080', '#83c092'] },
    { id: 'arctic',   name: 'Arctic',   dark: true,  c: ['#2e3440', '#88c0d0', '#a3be8c'] },
    { id: 'mocha',    name: 'Mocha',    dark: true,  c: ['#1e1e2e', '#b4befe', '#a6e3a1'] },
    { id: 'dragon',   name: 'Dragon',   dark: true,  c: ['#181616', '#c4b28a', '#8ba4b0'] }
  ];
  const DEFAULT = 'latte';
  const find = id => THEMES.find(t => t.id === id);

  let cur = DEFAULT;
  let writing = false, pending = false;

  /* single-record write, never overlapping */
  async function save() {
    if (writing) { pending = true; return; }
    writing = true;
    try { await Neutralino.storage.setData(PREF, JSON.stringify({ v: 1, theme: cur })); }
    catch (e) { try { localStorage.setItem(PREF, cur); } catch (e2) {} }
    finally { writing = false; if (pending) { pending = false; save(); } }
  }

  async function load() {
    try {
      const p = JSON.parse(await Neutralino.storage.getData(PREF));
      if (p && find(p.theme)) return p.theme;
    } catch (e) {}
    try { const v = localStorage.getItem(PREF); if (find(v)) return v; } catch (e) {}
    return DEFAULT;
  }

  /* clear superseded preference records so storage does not accumulate */
  async function prune() {
    for (const k of LEGACY_LS) {
      try { localStorage.removeItem(k); } catch (e) {}
      try { await Neutralino.storage.setData(k); } catch (e) {}
    }
  }

  function apply(id, announce, persistIt) {
    const t = find(id); if (!t) return;
    cur = id;
    root.setAttribute('data-theme', id);
    root.style.colorScheme = t.dark ? 'dark' : 'light';
    if (btn) btn.title = `Theme: ${t.name} (Ctrl+Shift+L cycles)`;
    paintMenu();
    if (persistIt) save();
    if (announce) {
      const el = document.getElementById('toast');
      if (el) {
        el.textContent = t.name;
        el.hidden = false;
        clearTimeout(el._tt);
        el._tt = setTimeout(() => { el.hidden = true; }, 1200);
      }
    }
  }

  /* ---- picker ---- */
  let menu = null;
  function buildMenu() {
    menu = document.createElement('div');
    menu.id = 'themeMenu';
    menu.hidden = true;
    menu.innerHTML = '<div class="tmHead">Theme</div>';
    THEMES.forEach((t, i) => {
      if (i === 3) menu.insertAdjacentHTML('beforeend', '<div class="tmSep"></div>');
      const b = document.createElement('button');
      b.className = 'tmItem';
      b.dataset.id = t.id;
      b.innerHTML = '<span class="sw"><i class="a"></i><i class="b"></i><i class="c"></i></span><span class="nm"></span>';
      b.querySelector('.nm').textContent = t.name;
      b.querySelector('.a').style.background = t.c[0];
      b.querySelector('.b').style.background = t.c[1];
      b.querySelector('.c').style.background = t.c[2];
      b.onclick = ev => { ev.stopPropagation(); apply(t.id, true, true); close(); };
      menu.appendChild(b);
    });
    (document.getElementById('shell') || document.body).appendChild(menu);
  }
  const paintMenu = () => {
    if (menu) menu.querySelectorAll('.tmItem').forEach(b => b.classList.toggle('sel', b.dataset.id === cur));
  };
  const close = () => { if (menu) menu.hidden = true; if (btn) btn.classList.remove('on'); };
  function toggle() {
    menu.hidden = !menu.hidden;
    if (btn) btn.classList.toggle('on', !menu.hidden);
    paintMenu();
  }

  if (btn) btn.onclick = e => { e.stopPropagation(); toggle(); };
  document.addEventListener('click', e => {
    if (menu && !menu.hidden && !menu.contains(e.target) && !e.target.closest('#btnTheme')) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu && !menu.hidden) { close(); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      const i = THEMES.findIndex(t => t.id === cur);
      apply(THEMES[(i + 1) % THEMES.length].id, true, true);
    }
  });

  (async () => {
    buildMenu();
    apply(DEFAULT, false, false);      // paint immediately, no flash
    const saved = await load();
    if (saved !== cur) apply(saved, false, false);
    prune();
  })();
})();
