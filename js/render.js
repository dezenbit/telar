/* Telar · composición final: genera, aplica marco, acabado (grano, papel, viñeta) y firma. */
(function (Telar) {
  'use strict';
  const { Color } = Telar;
  const WORLD = 1000;

  const ASPECTS = {
    '1:1': 1, '4:5': 5 / 4, '3:4': 4 / 3, '2:3': 3 / 2, '9:16': 16 / 9, '9:19.5': 19.5 / 9,
    'A': Math.SQRT2, '5:4': 4 / 5, '4:3': 3 / 4, '3:2': 2 / 3, '16:9': 9 / 16, '21:9': 9 / 21,
  };
  /* proporción alto/ancho */
  function ratioOf(aspect) { return ASPECTS[aspect] || 1; }

  function genById(id) { return Telar.generators.find((g) => g.id === id) || Telar.generators[0]; }

  function defaultsFor(gen) {
    const o = {};
    for (const p of gen.params) o[p.key] = p.def;
    return o;
  }

  /* Genera la lista de trazos. `res` = resolución en píxeles para capas raster. */
  const cache = { key: null, pen: null, ms: 0 };
  function generate(state, res = 1200, overrides) {
    const gen = genById(state.gen);
    const params = { ...defaultsFor(gen), ...(state.params[gen.id] || {}), ...(overrides || {}) };
    const w = WORLD, h = Math.round(WORLD * ratioOf(state.aspect));
    const key = JSON.stringify([gen.id, state.seed, params, state.palette.bg, state.palette.colors, state.aspect, Math.round(res)]);
    if (!overrides && cache.key === key) return { pen: cache.pen, ms: cache.ms, cached: true };
    const rng = Telar.makeRng(gen.id + '|' + state.seed);
    const noise = Telar.makeNoise(Telar.makeRng(state.seed + '|n'));
    const pen = new Telar.Pen(w, h);
    const pal = { bg: state.palette.bg, colors: state.palette.colors.length ? state.palette.colors : ['#000000'] };
    const t0 = performance.now();
    try {
      gen.draw({ pen, w, h, rng, noise, pal, p: params, res });
    } catch (err) {
      console.error('Telar: error en el generador', gen.id, err);
      pen.ops.length = 0; pen.background(pal.bg);
    }
    const ms = performance.now() - t0;
    if (!overrides) { cache.key = key; cache.pen = pen; cache.ms = ms; }
    return { pen, ms, cached: false };
  }

  /* Calcula el rectángulo interior según el marco (passe-partout). */
  function layout(pxW, pxH, finish) {
    const f = finish.frame || 0;
    const m = Math.round(Math.min(pxW, pxH) * f);
    const bottomExtra = finish.frame > 0 && finish.signature ? Math.round(m * 0.35) : 0;
    return { x: m, y: m, w: pxW - 2 * m, h: pxH - 2 * m - bottomExtra, m, bottomExtra };
  }

  function frameColor(state) {
    const fc = state.finish.frameColor;
    if (fc === 'white') return '#f7f4ee';
    if (fc === 'black') return '#111111';
    if (fc === 'ink') return state.palette.colors[0] || '#111111';
    if (fc && fc.startsWith('#')) return fc;
    return state.palette.bg;
  }

  /* Renderiza todo (o hasta `limit` trazos) en un canvas. */
  function renderFull(canvas, state, pxW, pxH, opts = {}) {
    canvas.width = pxW; canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    const L = layout(pxW, pxH, state.finish);
    const res = opts.res || Math.min(2400, Math.max(400, L.w));
    const { pen, ms } = opts.pen ? { pen: opts.pen, ms: 0 } : generate(state, res);
    ctx.fillStyle = frameColor(state);
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.beginPath(); ctx.rect(0, 0, L.w, L.h); ctx.clip();
    renderRange(ctx, pen, L.w, L.h, 0, opts.limit == null ? pen.ops.length : opts.limit);
    if (opts.limit == null || opts.limit >= pen.ops.length) applyFinish(ctx, state, L.w, L.h, pxW);
    ctx.restore();
    if (opts.limit == null || opts.limit >= pen.ops.length) drawSignature(ctx, state, pxW, pxH, L);
    return { pen, ms, layout: L };
  }

  /* Dibuja los trazos [start, end) sobre lo ya pintado, reabriendo recortes activos. */
  function renderRange(ctx, pen, w, h, start, end) {
    if (start === 0) return Telar.renderOps(ctx, pen, w, h, end);
    // Recortes abiertos antes de `start`
    const open = [];
    for (let i = 0; i < start; i++) {
      const t = pen.ops[i].t;
      if (t === 'clip') open.push(pen.ops[i]); else if (t === 'unclip') open.pop();
    }
    const sub = { w: pen.w, h: pen.h, ops: [...open, ...pen.ops.slice(start, end)] };
    Telar.renderOps(ctx, sub, w, h);
  }

  /* ───────── Acabado ───────── */
  const tileCache = new Map();
  function noiseTile(seed, kind) {
    const key = seed + '|' + kind;
    if (tileCache.has(key)) return tileCache.get(key);
    const size = kind === 'paper' ? 512 : 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const img = x.createImageData(size, size);
    const rng = Telar.makeRng(key);
    if (kind === 'grain') {
      for (let i = 0; i < img.data.length; i += 4) { const v = rng.next() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    } else {
      const nz = Telar.makeNoise(rng);
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        // ruido periódico (se repite sin costuras) mezclando fibras alargadas
        const a = (i / size) * Math.PI * 2, b = (j / size) * Math.PI * 2;
        const fib = nz.n3(Math.cos(a) * 1.2, Math.sin(a) * 1.2, j / size * 40) * 0.5;
        const blot = nz.n3(Math.cos(a) * 0.5 + 9, Math.sin(a) * 0.5, Math.cos(b) * 0.5 + Math.sin(b) * 0.5) * 0.6;
        const v = 200 + (fib + blot) * 55 + (rng.next() - 0.5) * 18;
        const o = (j * size + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    tileCache.set(key, c);
    return c;
  }

  function applyFinish(ctx, state, w, h, pxW) {
    const f = state.finish;
    const k = pxW / 1000; // escala del grano relativa al tamaño de salida
    if (f.paper > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = f.paper;
      const tile = noiseTile(state.seed, 'paper');
      const pat = ctx.createPattern(tile, 'repeat');
      pat.setTransform(new DOMMatrix().scale(Math.max(1, k)));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (f.vignette > 0) {
      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    if (f.grain > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = f.grain;
      const tile = noiseTile(state.seed, 'grain');
      const pat = ctx.createPattern(tile, 'repeat');
      pat.setTransform(new DOMMatrix().scale(Math.max(1, k * (f.grainSize || 1))));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawSignature(ctx, state, pxW, pxH, L) {
    const f = state.finish;
    if (!f.signature) return;
    const text = (f.signText || '').trim() || `Telar · ${state.seed}`;
    const inFrame = L.m > 0;
    const size = inFrame ? Math.max(9, L.m * 0.32) : Math.max(10, pxW * 0.014);
    ctx.save();
    ctx.font = `${size}px "Martian Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    let color;
    if (inFrame) {
      const fc = frameColor(state);
      color = Color.luminance(fc) > 0.45 ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.7)';
      ctx.fillStyle = color;
      ctx.fillText(text, L.x + L.w, L.y + L.h + (L.m + L.bottomExtra) / 2);
    } else {
      color = Color.luminance(state.palette.bg) > 0.45 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
      ctx.fillStyle = color;
      ctx.fillText(text, pxW - size * 1.6, pxH - size * 1.6);
    }
    ctx.restore();
  }

  /* SVG final, con marco y firma como elementos vectoriales. */
  function exportSVG(state, pxW, pxH) {
    const L = layout(pxW, pxH, state.finish);
    const { pen } = generate(state, Math.min(2400, L.w));
    const inner = Telar.toSVG(pen, L.w, L.h, {});
    const body = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const sx = L.w / pen.w, sy = L.h / pen.h;
    const gen = genById(state.gen);
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">`,
      `<title>${gen.name} · ${state.seed}</title>`,
      `<desc>Hecho con Telar. Generador: ${gen.name}. Semilla: ${state.seed}. Paleta: ${state.palette.name || 'personalizada'}.</desc>`,
      `<rect width="100%" height="100%" fill="${frameColor(state)}"/>`,
      `<svg x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" viewBox="0 0 ${pen.w} ${pen.h}" preserveAspectRatio="none">${body}</svg>`,
    ];
    if (state.finish.signature) {
      const text = (state.finish.signText || '').trim() || `Telar · ${state.seed}`;
      const inFrame = L.m > 0;
      const size = inFrame ? Math.max(9, L.m * 0.32) : Math.max(10, pxW * 0.014);
      const base = inFrame ? frameColor(state) : state.palette.bg;
      const fill = Color.luminance(base) > 0.45 ? '#000000' : '#ffffff';
      const x = inFrame ? L.x + L.w : pxW - size * 1.6;
      const y = inFrame ? L.y + L.h + (L.m + L.bottomExtra) / 2 : pxH - size * 1.6;
      parts.push(`<text x="${x}" y="${y}" text-anchor="end" dominant-baseline="middle" font-family="Martian Mono, monospace" font-size="${size}" fill="${fill}" fill-opacity="0.6">${text.replace(/[<&]/g, '')}</text>`);
    }
    parts.push('</svg>');
    void sx; void sy;
    return parts.join('\n');
  }

  Object.assign(Telar, { WORLD, ASPECTS, ratioOf, genById, defaultsFor, generate, renderFull, renderRange, layout, exportSVG, frameColor });
})(window.Telar);
