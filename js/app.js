/* Telar · interfaz */
(function (Telar) {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { Color } = Telar;

  /* ───────── Almacenamiento seguro ───────── */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };

  /* ───────── Estado ───────── */
  const FINISH_DEFAULT = { grain: 0.1, grainSize: 1, paper: 0, vignette: 0, frame: 0, frameColor: 'bg', signature: false, signText: '' };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const palCopy = (p) => ({ name: p.name, tag: p.tag, bg: p.bg, colors: p.colors.slice() });

  function freshState() {
    return {
      gen: 'flujo',
      seed: Telar.randomSeed(),
      params: {},
      palette: palCopy(Telar.PALETTES[0]),
      locks: { bg: false, colors: [] },
      aspect: '4:5',
      finish: { ...FINISH_DEFAULT },
    };
  }

  function sanitize(s) {
    const base = freshState();
    if (!s || typeof s !== 'object') return base;
    const out = { ...base, ...s };
    if (!Telar.generators.some((g) => g.id === out.gen)) out.gen = base.gen;
    if (!out.palette || !Array.isArray(out.palette.colors) || !out.palette.colors.length) out.palette = base.palette;
    if (!Telar.ASPECTS[out.aspect]) out.aspect = base.aspect;
    out.finish = { ...FINISH_DEFAULT, ...(s.finish || {}) };
    out.locks = { bg: false, colors: [], ...(s.locks || {}) };
    out.params = s.params && typeof s.params === 'object' ? s.params : {};
    out.seed = String(out.seed || base.seed).slice(0, 80);
    return out;
  }

  function encodeState(s) {
    const json = JSON.stringify({ gen: s.gen, seed: s.seed, params: { [s.gen]: s.params[s.gen] || {} }, palette: s.palette, aspect: s.aspect, finish: s.finish });
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(str) {
    try {
      const b = str.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch { return null; }
  }

  let state = (() => {
    const m = location.hash.match(/^#s=(.+)$/);
    if (m) { const d = decodeState(m[1]); if (d) return sanitize(d); }
    return sanitize(store.get('telar.state', null));
  })();

  /* ───────── Historial ───────── */
  const history = { stack: [JSON.stringify(state)], i: 0 };
  function commit() {
    const snap = JSON.stringify(state);
    if (snap === history.stack[history.i]) return;
    history.stack = history.stack.slice(0, history.i + 1);
    history.stack.push(snap);
    if (history.stack.length > 120) history.stack.shift();
    history.i = history.stack.length - 1;
    store.set('telar.state', state);
    syncHistoryButtons();
  }
  function undo() { if (history.i > 0) { history.i--; state = JSON.parse(history.stack[history.i]); refreshAll(); } }
  function redo() { if (history.i < history.stack.length - 1) { history.i++; state = JSON.parse(history.stack[history.i]); refreshAll(); } }
  function syncHistoryButtons() {
    $('#btnUndo').disabled = history.i <= 0;
    $('#btnRedo').disabled = history.i >= history.stack.length - 1;
  }

  /* ───────── Utilidades de UI ───────── */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  const ICON = {
    dice: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" class="dot"/><circle cx="15.5" cy="15.5" r="1.3" class="dot"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  };
  const fmt = (v, step) => {
    if (typeof v !== 'number') return v;
    const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
    return v.toFixed(d);
  };
  const setFill = (input) => {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', p + '%');
  };
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const currentGen = () => Telar.genById(state.gen);
  const paramsOf = (gen) => ({ ...Telar.defaultsFor(gen), ...(state.params[gen.id] || {}) });

  /* ───────── Render principal ───────── */
  const canvas = $('#canvas');
  let renderQueued = false, lastMs = 0, anim = null;
  function previewSize() {
    const wrap = $('#canvasWrap');
    const cs = getComputedStyle(wrap);
    const availW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const r = Telar.ratioOf(state.aspect);
    let w = availW, h = w * r;
    if (h > availH) { h = availH; w = h / r; }
    w = Math.max(60, Math.floor(w)); h = Math.max(60, Math.floor(h));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { cssW: w, cssH: h, pxW: Math.round(w * dpr), pxH: Math.round(h * dpr) };
  }
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    stopAnim();
    const heavy = lastMs > 160;
    if (heavy) $('#busy').hidden = false;
    const go = () => { renderQueued = false; doRender(); $('#busy').hidden = true; };
    if (heavy) requestAnimationFrame(() => setTimeout(go, 0)); else requestAnimationFrame(go);
  }
  function doRender(customState) {
    const s = customState || state;
    const size = previewSize();
    canvas.style.width = size.cssW + 'px'; canvas.style.height = size.cssH + 'px';
    const saved = state; state = s;
    const t0 = performance.now();
    const { pen, ms } = Telar.renderFull(canvas, s, size.pxW, size.pxH);
    if (!customState && ms) lastMs = ms;
    state = saved;
    if (!customState) {
      const gen = Telar.genById(s.gen);
      $('#stageInfo').innerHTML = `<span><b>${gen.name}</b></span><span>${pen.ops.length.toLocaleString('es-MX')} trazos</span><span>${Math.round(performance.now() - t0)} ms</span><span>${s.aspect === 'A' ? 'ISO A' : s.aspect}</span>`;
    }
  }

  /* Animación de construcción: dibuja los trazos poco a poco. */
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; $('#btnBuild').classList.remove('on'); } }
  function animateBuild(target, s, pxW, pxH, { duration, onDone } = {}) {
    const L = Telar.layout(pxW, pxH, s.finish);
    const { pen } = Telar.generate(s, Math.min(2400, Math.max(400, L.w)));
    target.width = pxW; target.height = pxH;
    const ctx = target.getContext('2d');
    ctx.fillStyle = Telar.frameColor(s); ctx.fillRect(0, 0, pxW, pxH);
    const N = pen.ops.length;
    const dur = duration || Math.min(9000, Math.max(2600, N * 2.2));
    const t0 = performance.now();
    let drawn = 0;
    const state0 = { raf: 0 };
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const upto = Math.max(1, Math.floor(e * N));
      if (upto > drawn) {
        ctx.save(); ctx.translate(L.x, L.y); ctx.beginPath(); ctx.rect(0, 0, L.w, L.h); ctx.clip();
        Telar.renderRange(ctx, pen, L.w, L.h, drawn, upto);
        ctx.restore();
        drawn = upto;
      }
      if (t < 1) state0.raf = requestAnimationFrame(step);
      else {
        const saved = state; state = s;
        Telar.renderFull(target, s, pxW, pxH, { pen });
        state = saved;
        onDone && onDone();
      }
    };
    state0.raf = requestAnimationFrame(step);
    return state0;
  }
  function playBuild() {
    if (anim) { stopAnim(); doRender(); return; }
    const size = previewSize();
    $('#btnBuild').classList.add('on');
    anim = animateBuild(canvas, state, size.pxW, size.pxH, { onDone: () => { anim = null; $('#btnBuild').classList.remove('on'); } });
  }

  /* ───────── Generadores (lista con miniaturas) ───────── */
  const THUMB = { atractor: { iters: 0.35 }, circulos: { attempts: 2500 }, flujo: { count: 380, steps: 90 }, voronoi: { sites: 70 }, acuarela: { layers: 12 }, trama: { cells: 26 }, topografia: { res: 80 }, crestas: { lines: 26 } };
  let thumbJob = 0;
  function buildGenList() {
    const list = $('#genList');
    list.innerHTML = '';
    const families = [...new Set(Telar.generators.map((g) => g.family))];
    for (const fam of families) {
      list.append(el('div', { class: 'gen-family' }, fam));
      for (const g of Telar.generators.filter((x) => x.family === fam)) {
        const c = el('canvas', { width: 160, height: 160, 'data-thumb': g.id });
        const card = el('button', { class: 'gen-card', 'data-gen': g.id, title: g.desc, onclick: () => selectGen(g.id) }, c, el('span', {}, g.name));
        list.append(card);
      }
    }
    $('#genCount').textContent = `${Telar.generators.length} técnicas`;
    syncGenList();
    renderThumbs();
  }
  function syncGenList() { $$('.gen-card').forEach((c) => c.classList.toggle('active', c.dataset.gen === state.gen)); }
  function renderThumbs() {
    const job = ++thumbJob;
    const gens = Telar.generators.slice();
    const s = { ...clone(state), aspect: '1:1', seed: 'muestra-telar', params: {}, finish: { ...FINISH_DEFAULT, grain: 0, frame: 0, signature: false } };
    const next = () => {
      if (job !== thumbJob || !gens.length) return;
      const g = gens.shift();
      const c = $(`canvas[data-thumb="${g.id}"]`);
      if (c) {
        const st = { ...s, gen: g.id };
        const { pen } = Telar.generate(st, 160, THUMB[g.id] || {});
        const saved = state; state = st;
        Telar.renderFull(c, st, 160, 160, { pen });
        state = saved;
      }
      if (window.requestIdleCallback) requestIdleCallback(next, { timeout: 250 }); else setTimeout(next, 16);
    };
    setTimeout(next, 30);
  }
  let thumbTimer;
  const scheduleThumbs = () => { clearTimeout(thumbTimer); thumbTimer = setTimeout(renderThumbs, 500); };

  function selectGen(id) {
    if (state.gen === id) return;
    state.gen = id;
    syncGenList(); buildParams(); requestRender(); commit();
    if (matchMedia('(max-width: 860px)').matches) setTab('ajustes');
  }

  /* ───────── Parámetros ───────── */
  function paramControl(def, value, onInput, onCommit) {
    const wrap = el('div', { class: 'param' });
    const id = 'p-' + def.key + '-' + Math.random().toString(36).slice(2, 6);
    const label = el('label', { class: 'param-label', for: id }, def.label, def.hint ? el('small', {}, def.hint) : null);
    if (def.type === 'range') {
      const out = el('span', { class: 'param-value' }, fmt(value, def.step));
      const input = el('input', { type: 'range', id, min: def.min, max: def.max, step: def.step, value });
      const dice = el('button', { class: 'param-dice', type: 'button', title: 'Valor al azar', 'aria-label': `${def.label} al azar`, html: ICON.dice });
      setFill(input);
      input.addEventListener('input', () => { const v = parseFloat(input.value); out.textContent = fmt(v, def.step); setFill(input); onInput(v); });
      input.addEventListener('change', onCommit);
      dice.addEventListener('click', () => {
        const steps = Math.round((def.max - def.min) / def.step);
        const v = +(def.min + Math.floor(Math.random() * (steps + 1)) * def.step).toFixed(6);
        input.value = v; out.textContent = fmt(v, def.step); setFill(input); onInput(v); onCommit();
      });
      out.prepend(dice);
      wrap.append(label, out, input);
    } else if (def.type === 'select') {
      if (def.options.length <= 4) {
        const pills = el('div', { class: 'seg-pills', role: 'radiogroup', 'aria-label': def.label });
        def.options.forEach(([v, l]) => {
          const b = el('button', { type: 'button', class: v === value ? 'active' : '', role: 'radio', 'aria-checked': String(v === value) }, l);
          b.addEventListener('click', () => {
            $$('button', pills).forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-checked', 'false'); });
            b.classList.add('active'); b.setAttribute('aria-checked', 'true');
            onInput(v); onCommit();
          });
          pills.append(b);
        });
        wrap.append(el('span', { class: 'param-label' }, def.label), el('span'), pills);
      } else {
        const sel = el('select', { class: 'select', id });
        def.options.forEach(([v, l]) => sel.append(el('option', { value: v, selected: v === value }, l)));
        sel.addEventListener('change', () => { onInput(sel.value); onCommit(); });
        wrap.append(label, el('span'), sel);
      }
    } else if (def.type === 'toggle') {
      const input = el('input', { type: 'checkbox', id, checked: !!value });
      input.addEventListener('change', () => { onInput(input.checked); onCommit(); });
      wrap.append(label, el('span', { class: 'switch' }, input, el('span')));
    } else if (def.type === 'text') {
      const input = el('input', { type: 'text', id, class: 'text-field', value: value || '', placeholder: def.placeholder || '', maxlength: 60 });
      input.addEventListener('input', () => onInput(input.value));
      input.addEventListener('change', onCommit);
      wrap.append(label, el('span'), input);
    }
    return wrap;
  }

  function buildParams() {
    const gen = currentGen();
    $('#paramsTitle').textContent = gen.name;
    $('#genDesc').textContent = gen.desc;
    const box = $('#params');
    box.innerHTML = '';
    const vals = paramsOf(gen);
    for (const def of gen.params) {
      box.append(paramControl(def, vals[def.key], (v) => {
        state.params[gen.id] = { ...(state.params[gen.id] || {}), [def.key]: v };
        requestRender();
      }, commit));
    }
  }

  function mutateParams(amount = 0.18, s = state, rnd = Math.random) {
    const gen = Telar.genById(s.gen);
    const cur = { ...Telar.defaultsFor(gen), ...(s.params[gen.id] || {}) };
    for (const d of gen.params) {
      if (d.type !== 'range') continue;
      const span = (d.max - d.min) * amount;
      let v = cur[d.key] + (rnd() * 2 - 1) * span;
      v = Math.round(Math.min(d.max, Math.max(d.min, v)) / d.step) * d.step;
      cur[d.key] = +v.toFixed(6);
    }
    s.params[gen.id] = cur;
  }
  function randomParams(s = state, rnd = Math.random) {
    const gen = Telar.genById(s.gen);
    const cur = {};
    for (const d of gen.params) {
      if (d.type === 'range') {
        // sesgo hacia el centro para evitar extremos poco útiles
        const t = (rnd() + rnd() + rnd()) / 3;
        cur[d.key] = +(Math.round((d.min + t * (d.max - d.min)) / d.step) * d.step).toFixed(6);
      } else if (d.type === 'select') cur[d.key] = d.options[Math.floor(rnd() * d.options.length)][0];
      else if (d.type === 'toggle') cur[d.key] = rnd() < 0.5;
    }
    s.params[gen.id] = cur;
  }

  /* ───────── Paleta ───────── */
  let paletteFilter = 'Todas';
  function buildSwatches() {
    const box = $('#swatches');
    box.innerHTML = '';
    const p = state.palette;
    const mk = (hex, isBg, idx) => {
      const sw = el('div', { class: 'swatch' + (isBg ? ' bg' : '') });
      const fill = el('span', { class: 'fillc' }); fill.style.background = hex;
      const input = el('input', { type: 'color', value: hex, 'aria-label': isBg ? 'Color de fondo' : `Color ${idx + 1}` });
      input.addEventListener('input', () => {
        if (isBg) p.bg = input.value; else p.colors[idx] = input.value;
        p.name = 'Personalizada';
        fill.style.background = input.value; tag.textContent = input.value.slice(1).toUpperCase();
        $('#paletteName').textContent = p.name;
        requestRender();
      });
      input.addEventListener('change', () => { commit(); buildPaletteGrid(); scheduleThumbs(); });
      const locked = isBg ? state.locks.bg : !!state.locks.colors[idx];
      const lock = el('button', { class: 'lock' + (locked ? ' on' : ''), type: 'button', title: locked ? 'Desfijar' : 'Fijar al generar armonías', 'aria-pressed': String(locked), html: ICON.lock });
      lock.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isBg) state.locks.bg = !state.locks.bg; else state.locks.colors[idx] = !state.locks.colors[idx];
        buildSwatches(); commit();
      });
      const tag = el('span', { class: 'tag' }, hex.slice(1).toUpperCase());
      sw.append(fill, input, lock, tag);
      return sw;
    };
    box.append(mk(p.bg, true));
    p.colors.forEach((c, i) => box.append(mk(c, false, i)));
    $('#paletteName').textContent = p.name || 'Personalizada';
  }
  function buildPaletteTags() {
    const tags = ['Todas', ...new Set(Telar.PALETTES.map((p) => p.tag))];
    const box = $('#paletteTags');
    box.innerHTML = '';
    tags.forEach((t) => box.append(el('button', { class: 'chip' + (t === paletteFilter ? ' active' : ''), type: 'button', onclick: () => { paletteFilter = t; buildPaletteTags(); buildPaletteGrid(); } }, t)));
  }
  function buildPaletteGrid() {
    const box = $('#paletteGrid');
    box.innerHTML = '';
    Telar.PALETTES.filter((p) => paletteFilter === 'Todas' || p.tag === paletteFilter).forEach((p) => {
      const strip = el('div', { class: 'pal-strip' });
      [p.bg, ...p.colors].forEach((c) => { const i = el('i'); i.style.background = c; strip.append(i); });
      const active = p.bg === state.palette.bg && p.colors.join() === state.palette.colors.join();
      box.append(el('button', { class: 'pal-card' + (active ? ' active' : ''), type: 'button', title: `${p.name} · ${p.tag}`, onclick: () => applyPalette(palCopy(p)) }, strip, el('span', {}, p.name)));
    });
  }
  function applyPalette(p, keepLocks = false) {
    if (keepLocks) {
      if (state.locks.bg) p.bg = state.palette.bg;
      state.palette.colors.forEach((c, i) => { if (state.locks.colors[i]) { if (i < p.colors.length) p.colors[i] = c; else p.colors.push(c); } });
    } else state.locks = { bg: false, colors: [] };
    state.palette = p;
    buildSwatches(); buildPaletteGrid(); requestRender(); commit(); scheduleThumbs();
  }
  function harmony() {
    const rng = Telar.makeRng(Math.floor(Math.random() * 1e9));
    const p = Telar.generateHarmony(rng, $('#harmonyMode').value || null);
    applyPalette(p, true);
    toast(p.name);
  }
  function randomCurated() {
    const opts = Telar.PALETTES.filter((p) => p.name !== state.palette.name);
    applyPalette(palCopy(opts[Math.floor(Math.random() * opts.length)]));
    toast(state.palette.name);
  }

  /* ───────── Lienzo y acabado ───────── */
  const ASPECT_LIST = [['1:1', '1:1'], ['4:5', '4:5'], ['3:4', '3:4'], ['2:3', '2:3'], ['9:16', '9:16'], ['9:19.5', 'Tel.'], ['A', 'ISO A'], ['5:4', '5:4'], ['4:3', '4:3'], ['3:2', '3:2'], ['16:9', '16:9'], ['21:9', '21:9']];
  function buildAspects() {
    const box = $('#aspectGrid');
    box.innerHTML = '';
    for (const [k, label] of ASPECT_LIST) {
      const r = Telar.ratioOf(k);
      const i = el('i');
      const W = r <= 1 ? 22 : 22 / r, H = r <= 1 ? 22 * r : 22;
      i.style.width = W + 'px'; i.style.height = H + 'px';
      box.append(el('button', { class: 'aspect' + (k === state.aspect ? ' active' : ''), type: 'button', title: k === 'A' ? 'Papel ISO (A4, A3…)' : k === '9:19.5' ? 'Pantalla de teléfono' : k, onclick: () => { state.aspect = k; buildAspects(); requestRender(); commit(); } }, i, label));
    }
  }
  const FINISH_DEFS = [
    { key: 'grain', label: 'Grano', type: 'range', min: 0, max: 0.6, step: 0.01 },
    { key: 'grainSize', label: 'Tamaño del grano', type: 'range', min: 1, max: 4, step: 0.1 },
    { key: 'paper', label: 'Textura de papel', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'vignette', label: 'Viñeta', type: 'range', min: 0, max: 0.8, step: 0.01 },
    { key: 'frame', label: 'Marco', type: 'range', min: 0, max: 0.16, step: 0.005, hint: 'passe-partout' },
    { key: 'frameColor', label: 'Color del marco', type: 'select', options: [['bg', 'Fondo'], ['white', 'Blanco'], ['black', 'Negro'], ['ink', 'Tinta']] },
    { key: 'signature', label: 'Firma', type: 'toggle' },
    { key: 'signText', label: 'Texto de la firma', type: 'text', placeholder: 'Telar · semilla' },
  ];
  function buildFinish() {
    const box = $('#finishParams');
    box.innerHTML = '';
    for (const def of FINISH_DEFS) {
      box.append(paramControl(def, state.finish[def.key], (v) => { state.finish[def.key] = v; requestRender(); }, commit));
    }
  }

  /* ───────── Variaciones ───────── */
  let varMode = 'seed';
  function openVariations() {
    openModal('#modalVariations');
    buildVariations();
  }
  function buildVariations() {
    const grid = $('#varGrid');
    grid.innerHTML = '';
    const list = [];
    for (let i = 0; i < 9; i++) {
      const s = clone(state);
      if (i === 4 && varMode !== 'all') { list.push({ s, label: 'Actual' }); continue; }
      if (varMode === 'seed' || varMode === 'all') s.seed = Telar.randomSeed();
      if (varMode === 'params') mutateParams(0.25, s);
      if (varMode === 'all') { const g = Telar.generators[Math.floor(Math.random() * Telar.generators.length)]; s.gen = g.id; if (Math.random() < 0.5) randomParams(s); }
      if (varMode === 'palette' || varMode === 'all') {
        const p = Telar.PALETTES[Math.floor(Math.random() * Telar.PALETTES.length)];
        s.palette = palCopy(Math.random() < 0.2 ? Telar.generateHarmony(Telar.makeRng(Math.random() * 1e9)) : p);
      }
      list.push({ s, label: varMode === 'palette' ? s.palette.name : varMode === 'all' ? Telar.genById(s.gen).name : s.seed });
    }
    const r = Telar.ratioOf(state.aspect);
    const W = 320, H = Math.round(W * r);
    const cells = list.map(({ s, label }) => {
      const c = el('canvas', { width: W, height: H });
      const b = el('button', { class: 'var-item', type: 'button', onclick: () => { state = s; refreshAll(); commit(); closeModal(); toast('Variación adoptada'); } }, c, el('small', {}, label));
      grid.append(b);
      return { c, s };
    });
    let i = 0;
    const next = () => {
      if (i >= cells.length || $('#modalVariations').hidden) return;
      const { c, s } = cells[i++];
      const saved = state; state = s;
      const { pen } = Telar.generate(s, W, THUMB[s.gen] ? { ...(s.params[s.gen] || {}), ...shrink(s) } : undefined);
      Telar.renderFull(c, s, W, H, { pen });
      state = saved;
      setTimeout(next, 10);
    };
    setTimeout(next, 20);
  }
  /* reduce el trabajo de los generadores pesados en miniaturas, conservando su aspecto */
  function shrink(s) {
    const t = THUMB[s.gen] || {};
    const p = { ...Telar.defaultsFor(Telar.genById(s.gen)), ...(s.params[s.gen] || {}) };
    const o = {};
    for (const k in t) o[k] = Math.min(p[k], Math.max(t[k], p[k] * 0.5));
    return o;
  }

  /* ───────── Galería ───────── */
  const gallery = { items: store.get('telar.gallery', []) };
  function saveGallery() {
    if (!store.set('telar.gallery', gallery.items)) toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado');
    $('#galleryCount').textContent = gallery.items.length;
  }
  function thumbFor(s, size = 360) {
    const c = document.createElement('canvas');
    const r = Telar.ratioOf(s.aspect);
    const W = r >= 1 ? Math.round(size / r) : size, H = r >= 1 ? size : Math.round(size * r);
    const saved = state; state = s;
    Telar.renderFull(c, s, W, H);
    state = saved;
    return c;
  }
  function saveToGallery() {
    const c = thumbFor(state, 360);
    gallery.items.unshift({ id: Date.now().toString(36), t: Date.now(), state: clone(state), thumb: c.toDataURL('image/jpeg', 0.82) });
    if (gallery.items.length > 80) gallery.items.length = 80;
    saveGallery();
    toast('Guardada en la galería');
    const b = $('#btnSave'); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 600);
  }
  function buildGallery() {
    const grid = $('#galleryGrid');
    grid.innerHTML = '';
    if (!gallery.items.length) {
      grid.append(el('div', { class: 'gal-empty' }, el('strong', {}, 'Todavía no hay obras guardadas'), 'Pulsa Guardar o la tecla S para conservar la obra actual con su semilla, ajustes y paleta.'));
      return;
    }
    for (const it of gallery.items) {
      const g = Telar.genById(it.state.gen);
      const del = el('button', { type: 'button', title: 'Eliminar', 'aria-label': 'Eliminar de la galería', html: ICON.trash });
      del.addEventListener('click', () => { gallery.items = gallery.items.filter((x) => x.id !== it.id); saveGallery(); buildGallery(); });
      const img = el('img', { src: it.thumb, alt: `${g.name}, semilla ${it.state.seed}`, loading: 'lazy' });
      img.addEventListener('click', () => { state = sanitize(clone(it.state)); refreshAll(); commit(); closeModal(); toast('Obra restaurada'); });
      grid.append(el('div', { class: 'gal-item' }, img, el('div', { class: 'gal-meta' }, el('span', { title: it.state.seed }, `${g.name} · ${it.state.seed}`), del)));
    }
  }

  /* ───────── Exportación ───────── */
  const EXPORT_PRESETS = [
    { label: 'Instagram 4:5', aspect: '4:5', size: 1350 },
    { label: 'Historia 9:16', aspect: '9:16', size: 1920 },
    { label: 'Fondo de teléfono', aspect: '9:19.5', size: 2340 },
    { label: 'Escritorio 4K', aspect: '16:9', size: 3840 },
    { label: 'Cuadrado 2K', aspect: '1:1', size: 2048 },
    { label: 'A4 · 300 ppp', aspect: 'A', size: 3508 },
    { label: 'A3 · 300 ppp', aspect: 'A', size: 4961 },
  ];
  let exportSize = store.get('telar.exportSize', 2400);
  function exportDims() {
    const r = Telar.ratioOf(state.aspect);
    return r >= 1 ? { w: Math.round(exportSize / r), h: exportSize } : { w: exportSize, h: Math.round(exportSize * r) };
  }
  function openExport() {
    openModal('#modalExport');
    const box = $('#exportPresets');
    box.innerHTML = '';
    EXPORT_PRESETS.forEach((p) => box.append(el('button', { class: 'chip', type: 'button', onclick: () => {
      state.aspect = p.aspect; exportSize = p.size; buildAspects(); requestRender(); commit(); syncExport();
    } }, p.label)));
    syncExport();
  }
  function syncExport() {
    const s = $('#exportSize');
    s.value = exportSize; setFill(s);
    $('#exportSizeOut').textContent = exportSize + ' px';
    const { w, h } = exportDims();
    const mp = (w * h / 1e6).toFixed(1);
    const at300 = `${(w / 300 * 2.54).toFixed(1)} × ${(h / 300 * 2.54).toFixed(1)} cm a 300 ppp`;
    $('#exportDims').textContent = `${w} × ${h} px · ${mp} MP · ${at300}`;
    $('#exportPreview').src = thumbFor(state, 420).toDataURL('image/png');
    $('#exportStatus').textContent = '';
  }
  const fileBase = () => `telar-${state.gen}-${slug(state.seed)}`;
  const status = (msg) => { $('#exportStatus').textContent = msg; };
  function renderExportCanvas() {
    const { w, h } = exportDims();
    const c = document.createElement('canvas');
    Telar.renderFull(c, state, w, h, { res: Math.min(2400, w) });
    return c;
  }
  function exportRaster(type) {
    status('Renderizando a tamaño completo…');
    setTimeout(() => {
      try {
        const c = renderExportCanvas();
        c.toBlob((blob) => {
          if (!blob) { status('El navegador no pudo crear la imagen. Prueba con un tamaño menor.'); return; }
          download(blob, `${fileBase()}.${type === 'image/png' ? 'png' : 'jpg'}`);
          status(`Listo: ${c.width} × ${c.height} px, ${(blob.size / 1024 / 1024).toFixed(1)} MB.`);
        }, type, 0.93);
      } catch (e) { console.error(e); status('No se pudo renderizar a ese tamaño. Reduce el lado largo e inténtalo de nuevo.'); }
    }, 30);
  }
  function exportSVG() {
    const { w, h } = exportDims();
    const svg = Telar.exportSVG(state, w, h);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    download(blob, `${fileBase()}.svg`);
    status(`SVG listo: ${(blob.size / 1024).toFixed(0)} KB${currentGen().id === 'atractor' || (currentGen().id === 'topografia' && paramsOf(currentGen()).bands) ? ' (incluye una capa raster)' : ''}.`);
  }
  function exportJSON() {
    const recipe = { app: 'Telar', version: 1, created: new Date().toISOString(), generator: currentGen().name, ...clone(state) };
    download(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }), `${fileBase()}.json`);
    status('Receta guardada. Arrástrala sobre Telar para volver a abrirla.');
  }
  function exportVideo() {
    const c = document.createElement('canvas');
    if (!c.captureStream || !window.MediaRecorder) { status('Este navegador no permite grabar video desde un lienzo.'); return; }
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) { status('No hay un formato de video compatible en este navegador.'); return; }
    const { w, h } = exportDims();
    const k = Math.min(1, 1920 / Math.max(w, h));
    const W = Math.round(w * k / 2) * 2, H = Math.round(h * k / 2) * 2;
    c.width = W; c.height = H;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      download(blob, `${fileBase()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
      status(`Video listo: ${W} × ${H}, ${(blob.size / 1024 / 1024).toFixed(1)} MB.`);
    };
    status('Grabando la construcción…');
    rec.start(200);
    animateBuild(c, clone(state), W, H, { duration: 6000, onDone: () => setTimeout(() => rec.stop(), 1500) });
  }
  async function copyLink() {
    const url = location.href.split('#')[0] + '#s=' + encodeState(state);
    try { await navigator.clipboard.writeText(url); status('Enlace copiado. Quien lo abra verá exactamente esta obra.'); }
    catch { status('No se pudo copiar automáticamente. Enlace: ' + url); }
  }

  /* ───────── Modales ───────── */
  let lastFocus = null;
  function openModal(sel) {
    closeModal();
    lastFocus = document.activeElement;
    const m = $(sel); m.hidden = false;
    const f = $('button, [href], input, select', m.querySelector('.modal-card')); f && f.focus();
  }
  function closeModal() {
    $$('.modal').forEach((m) => (m.hidden = true));
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ───────── Atajos ───────── */
  const KEYS = [
    [['Espacio', 'N'], 'Nueva semilla', () => newSeed()],
    [['Z'], 'Deshacer', undo], [['Y'], 'Rehacer', redo],
    [['M'], 'Mutar ajustes', () => { mutateParams(); buildParams(); requestRender(); commit(); toast('Ajustes mutados'); }],
    [['A'], 'Ajustes al azar', () => { randomParams(); buildParams(); requestRender(); commit(); toast('Ajustes al azar'); }],
    [['P'], 'Paleta curada al azar', randomCurated],
    [['H'], 'Nueva armonía de color', harmony],
    [['V'], 'Variaciones', openVariations],
    [['B'], 'Animar construcción', playBuild],
    [['S'], 'Guardar en galería', saveToGallery],
    [['G'], 'Abrir galería', () => { buildGallery(); openModal('#modalGallery'); }],
    [['E'], 'Exportar', openExport],
    [['F'], 'Pantalla completa', fullscreen],
    [['←', '→'], 'Generador anterior / siguiente', null],
    [['?'], 'Esta ayuda', () => openModal('#modalHelp')],
    [['Esc'], 'Cerrar ventana', closeModal],
  ];
  function buildKeys() {
    const dl = $('#keysList');
    for (const [keys, label] of KEYS) dl.append(el('dt', {}, ...keys.map((k) => el('kbd', {}, k))), el('dd', {}, label));
  }
  function cycleGen(d) {
    const i = Telar.generators.findIndex((g) => g.id === state.gen);
    const g = Telar.generators[(i + d + Telar.generators.length) % Telar.generators.length];
    state.gen = g.id; syncGenList(); buildParams(); requestRender(); commit(); toast(g.name);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); stopAnim(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      return;
    }
    if (!$$('.modal').every((m) => m.hidden) && e.key !== '?') return;
    const k = e.key === ' ' ? 'Espacio' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (e.target.type === 'range' && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
    if (k === 'ArrowLeft') { cycleGen(-1); e.preventDefault(); return; }
    if (k === 'ArrowRight') { cycleGen(1); e.preventDefault(); return; }
    const hit = KEYS.find(([keys, , fn]) => fn && keys.includes(k));
    if (hit) { e.preventDefault(); hit[2](); }
  });

  /* ───────── Acciones ───────── */
  function newSeed() { state.seed = Telar.randomSeed(); $('#seedInput').value = state.seed; requestRender(); commit(); }
  function fullscreen() {
    const st = $('#stage');
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (st.requestFullscreen) st.requestFullscreen().then(() => setTimeout(requestRender, 120)).catch(() => toast('Este navegador no permite pantalla completa aquí'));
    else toast('Este navegador no permite pantalla completa aquí');
  }
  document.addEventListener('fullscreenchange', () => setTimeout(requestRender, 120));

  function setTab(tab) {
    document.body.dataset.mtab = tab;
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function refreshAll() {
    $('#seedInput').value = state.seed;
    syncGenList(); buildParams(); buildSwatches(); buildPaletteGrid(); buildAspects(); buildFinish();
    requestRender(); syncHistoryButtons();
    store.set('telar.state', state);
  }

  function loadRecipeFile(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (Array.isArray(data)) { importGallery(data); return; }
        state = sanitize(data); refreshAll(); commit(); toast('Receta cargada');
      } catch { toast('Ese archivo no es una receta de Telar'); }
    };
    r.readAsText(file);
  }
  function importGallery(arr) {
    const valid = arr.filter((x) => x && x.state && x.thumb);
    const ids = new Set(gallery.items.map((x) => x.id));
    gallery.items = [...valid.filter((x) => !ids.has(x.id)), ...gallery.items].slice(0, 80);
    saveGallery(); buildGallery(); toast(`${valid.length} obras importadas`);
  }
  function paletteFromFile(file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const p = Telar.paletteFromImage(img, 5);
      URL.revokeObjectURL(url);
      if (p) { applyPalette(p); toast('Paleta extraída de la foto'); } else toast('No se encontraron colores en la imagen');
    };
    img.onerror = () => toast('No se pudo leer la imagen');
    img.src = url;
  }

  function bind() {
    $('#seedInput').addEventListener('change', (e) => { state.seed = e.target.value.trim() || Telar.randomSeed(); e.target.value = state.seed; requestRender(); commit(); });
    $('#seedInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    $('#btnNewSeed').addEventListener('click', newSeed);
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnVariations').addEventListener('click', openVariations);
    $('#btnMoreVariations').addEventListener('click', buildVariations);
    $$('#varMode button').forEach((b) => b.addEventListener('click', () => { varMode = b.dataset.mode; $$('#varMode button').forEach((x) => x.classList.toggle('active', x === b)); buildVariations(); }));
    $('#btnGallery').addEventListener('click', () => { buildGallery(); openModal('#modalGallery'); });
    $('#btnSave').addEventListener('click', saveToGallery);
    $('#btnHelp').addEventListener('click', () => openModal('#modalHelp'));
    $('#btnExport').addEventListener('click', openExport);
    $('#btnBuild').addEventListener('click', playBuild);
    $('#btnFullscreen').addEventListener('click', fullscreen);
    $('#btnMutate').addEventListener('click', () => { mutateParams(); buildParams(); requestRender(); commit(); });
    $('#btnRandomParams').addEventListener('click', () => { randomParams(); buildParams(); requestRender(); commit(); });
    $('#btnResetParams').addEventListener('click', () => { delete state.params[state.gen]; buildParams(); requestRender(); commit(); toast('Valores originales'); });
    $('#btnHarmony').addEventListener('click', harmony);
    $('#btnShufflePal').addEventListener('click', () => { const c = state.palette.colors; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } buildSwatches(); requestRender(); commit(); });
    $('#btnSwapBg').addEventListener('click', () => { const p = state.palette; [p.bg, p.colors[0]] = [p.colors[0], p.bg]; buildSwatches(); requestRender(); commit(); });
    $('#btnAddColor').addEventListener('click', () => {
      const p = state.palette; if (p.colors.length >= 8) { toast('Máximo 8 colores'); return; }
      const base = p.colors[p.colors.length - 1] || '#888888';
      const [h, s, l] = Color.rgbToHsl(...Color.hexToRgb(base));
      p.colors.push(Color.hslToHex(h + 40 + Math.random() * 60, Math.max(0.4, s), 0.35 + Math.random() * 0.3));
      p.name = 'Personalizada'; buildSwatches(); requestRender(); commit();
    });
    $('#btnRemoveColor').addEventListener('click', () => { const p = state.palette; if (p.colors.length <= 1) return; p.colors.pop(); p.name = 'Personalizada'; buildSwatches(); requestRender(); commit(); });
    $('#btnCopyPalette').addEventListener('click', async () => {
      const css = `:root {\n  --bg: ${state.palette.bg};\n${state.palette.colors.map((c, i) => `  --c${i + 1}: ${c};`).join('\n')}\n}`;
      try { await navigator.clipboard.writeText(css); toast('Paleta copiada como variables CSS'); } catch { toast('No se pudo copiar'); }
    });
    $('#paletteImage').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) paletteFromFile(f); e.target.value = ''; });
    const harm = $('#harmonyMode');
    harm.append(el('option', { value: '' }, 'Cualquiera'));
    Telar.HARMONIES.forEach((h) => harm.append(el('option', { value: h }, h[0].toUpperCase() + h.slice(1))));
    $('#btnFinishReset').addEventListener('click', () => { state.finish = { ...FINISH_DEFAULT, grain: 0 }; buildFinish(); requestRender(); commit(); });

    $('#exportSize').addEventListener('input', (e) => { exportSize = +e.target.value; setFill(e.target); $('#exportSizeOut').textContent = exportSize + ' px'; const { w, h } = exportDims(); $('#exportDims').textContent = `${w} × ${h} px · ${(w * h / 1e6).toFixed(1)} MP`; });
    $('#exportSize').addEventListener('change', () => { store.set('telar.exportSize', exportSize); syncExport(); });
    $('#btnExportPNG').addEventListener('click', () => exportRaster('image/png'));
    $('#btnExportJPG').addEventListener('click', () => exportRaster('image/jpeg'));
    $('#btnExportSVG').addEventListener('click', exportSVG);
    $('#btnExportVideo').addEventListener('click', exportVideo);
    $('#btnExportJSON').addEventListener('click', exportJSON);
    $('#btnCopyLink').addEventListener('click', copyLink);
    $('#btnGalleryExport').addEventListener('click', () => download(new Blob([JSON.stringify(gallery.items)], { type: 'application/json' }), 'telar-galeria.json'));
    $('#galleryImport').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadRecipeFile(f); e.target.value = ''; });

    $$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    });
    $$('#tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

    // Comparar: mantener pulsado muestra la versión anterior del historial
    const cmp = $('#btnCompare');
    const showPrev = () => { if (history.i > 0) doRender(JSON.parse(history.stack[history.i - 1])); else toast('No hay versión anterior'); };
    const showCur = () => doRender();
    cmp.addEventListener('pointerdown', showPrev);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => cmp.addEventListener(ev, showCur));

    // Doble toque en la obra: nueva semilla
    canvas.addEventListener('dblclick', newSeed);

    // Arrastrar y soltar: imagen → paleta, JSON → receta
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (f.type.startsWith('image/')) paletteFromFile(f);
      else if (f.name.endsWith('.json')) loadRecipeFile(f);
    });

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(requestRender, 120); });
    if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(requestRender, 60); }).observe($('#canvasWrap'));
    window.addEventListener('hashchange', () => {
      const m = location.hash.match(/^#s=(.+)$/);
      if (m) { const d = decodeState(m[1]); if (d) { state = sanitize(d); refreshAll(); commit(); } }
    });
  }

  /* ───────── Arranque ───────── */
  function init() {
    setTab('generador');
    buildGenList(); buildPaletteTags(); buildKeys(); bind();
    $('#galleryCount').textContent = gallery.items.length;
    refreshAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (state.finish.signature) requestRender(); });
  }
  init();
  Telar.app = { get state() { return state; }, refreshAll, requestRender };
})(window.Telar);
