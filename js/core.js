/* Telar · núcleo: azar con semilla, ruido, color y el "pen" que graba trazos.
   Todo vive en el objeto global `Telar` para que el proyecto funcione
   también abriendo index.html directamente (file://), sin servidor. */
(function (global) {
  'use strict';
  const Telar = (global.Telar = global.Telar || {});

  /* ───────────── Azar con semilla ───────────── */
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const next = mulberry32(typeof seed === 'number' ? seed : hashString(String(seed)));
    const r = {
      next,
      float: (a = 0, b = 1) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      sign: () => (next() < 0.5 ? -1 : 1),
      gauss: (mean = 0, sd = 1) => {
        let u = 0, v = 0;
        while (u === 0) u = next();
        while (v === 0) v = next();
        return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
      weighted: (items, weights) => {
        const total = weights.reduce((s, w) => s + w, 0);
        let t = next() * total;
        for (let i = 0; i < items.length; i++) { t -= weights[i]; if (t <= 0) return items[i]; }
        return items[items.length - 1];
      },
    };
    return r;
  }

  const WORDS_A = ['ámbar','barro','cobre','delta','eco','fibra','grana','humo','índigo','jade','kilim','lumbre','marea','nácar','ocre','piedra','quetzal','río','sal','tule','umbral','vela','xique','yute','zafiro','alba','brasa','copal','duna','espiga'];
  const WORDS_B = ['lento','vivo','hondo','claro','tenue','roto','alto','suave','denso','fino','ancho','tibio','largo','breve','sereno'];
  function randomSeed() {
    const a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)];
    const b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
    return `${a}-${b}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  /* ───────────── Ruido simplex (2D/3D) con semilla ───────────── */
  function makeNoise(rng) {
    const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const F3 = 1 / 3, G3 = 1 / 6;

    function n2(xin, yin) {
      let n0 = 0, n1 = 0, n2v = 0;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) { const g = grad3[permMod12[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) { const g = grad3[permMod12[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) { const g = grad3[permMod12[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2v = t2 * t2 * (g[0] * x2 + g[1] * y2); }
      return 70 * (n0 + n1 + n2v);
    }

    function n3(xin, yin, zin) {
      let n0, n1, n2v, n3v;
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      const dot = (g, x, y, z) => g[0] * x + g[1] * y + g[2] * z;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      n0 = t0 < 0 ? 0 : ((t0 *= t0), t0 * t0 * dot(grad3[permMod12[ii + perm[jj + perm[kk]]]], x0, y0, z0));
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      n1 = t1 < 0 ? 0 : ((t1 *= t1), t1 * t1 * dot(grad3[permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]], x1, y1, z1));
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      n2v = t2 < 0 ? 0 : ((t2 *= t2), t2 * t2 * dot(grad3[permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]], x2, y2, z2));
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      n3v = t3 < 0 ? 0 : ((t3 *= t3), t3 * t3 * dot(grad3[permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]], x3, y3, z3));
      return 32 * (n0 + n1 + n2v + n3v);
    }

    function fbm(x, y, octaves = 4, lac = 2, gain = 0.5) {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) { sum += amp * n2(x * freq, y * freq); norm += amp; amp *= gain; freq *= lac; }
      return sum / norm;
    }
    return { n2, n3, fbm };
  }

  /* ───────────── Color ───────────── */
  const Color = {
    hexToRgb(hex) {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgbToHex(r, g, b) {
      const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
      return '#' + c(r) + c(g) + c(b);
    },
    rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0; const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [h, s, l];
    },
    hslToHex(h, s, l) {
      h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Color.rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
    },
    mix(a, b, t) {
      const A = Color.hexToRgb(a), B = Color.hexToRgb(b);
      return Color.rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    },
    luminance(hex) {
      const [r, g, b] = Color.hexToRgb(hex).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    contrast(a, b) {
      const la = Color.luminance(a), lb = Color.luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    },
    alpha(hex, a) {
      const [r, g, b] = Color.hexToRgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    },
    /* Interpola a lo largo de una lista de colores (t en 0..1) */
    ramp(colors, t) {
      t = Math.max(0, Math.min(1, t));
      if (colors.length === 1) return colors[0];
      const x = t * (colors.length - 1);
      const i = Math.min(colors.length - 2, Math.floor(x));
      return Color.mix(colors[i], colors[i + 1], x - i);
    },
    jitter(hex, rng, amount = 0.04) {
      const [h, s, l] = Color.rgbToHsl(...Color.hexToRgb(hex));
      return Color.hslToHex(h + rng.float(-20, 20) * amount * 10, s + rng.float(-amount, amount), l + rng.float(-amount, amount));
    },
  };

  /* ───────────── Pen: graba operaciones de dibujo en coordenadas de mundo ─────────────
     Cada generador dibuja con este objeto. Luego la misma lista de operaciones se
     renderiza en Canvas (vista previa, PNG, video) o se serializa a SVG. */
  class Pen {
    constructor(w, h) { this.w = w; this.h = h; this.ops = []; this.svgSafe = true; }
    _style(o) {
      return {
        fill: o.fill || null,
        stroke: o.stroke || null,
        lw: o.lw != null ? o.lw : 1,
        alpha: o.alpha != null ? o.alpha : 1,
        cap: o.cap || 'round',
        join: o.join || 'round',
        blend: o.blend || null,
      };
    }
    background(color) { this.ops.push({ t: 'bg', fill: color }); return this; }
    rect(x, y, w, h, o = {}) { this.ops.push({ t: 'rect', x, y, w, h, r: o.r || 0, ...this._style(o) }); return this; }
    circle(x, y, r, o = {}) { if (r > 0) this.ops.push({ t: 'circle', x, y, r, ...this._style(o) }); return this; }
    arc(x, y, r, a0, a1, o = {}) { this.ops.push({ t: 'arc', x, y, r, a0, a1, pie: !!o.pie, ...this._style(o) }); return this; }
    line(x1, y1, x2, y2, o = {}) { this.ops.push({ t: 'path', pts: [x1, y1, x2, y2], closed: false, ...this._style({ stroke: '#000', ...o }) }); return this; }
    /* pts: arreglo plano [x0,y0,x1,y1,...] */
    path(pts, o = {}) { if (pts.length >= 4) this.ops.push({ t: 'path', pts, closed: !!o.closed, smooth: !!o.smooth, ...this._style(o) }); return this; }
    poly(pts, o = {}) { return this.path(pts, { ...o, closed: true }); }
    /* Varios polígonos con un solo estilo (útil para huecos con evenodd) */
    compound(polys, o = {}) { this.ops.push({ t: 'compound', polys, ...this._style(o) }); return this; }
    raster(width, height, data, o = {}) {
      this.ops.push({ t: 'raster', rw: width, rh: height, data, x: o.x || 0, y: o.y || 0, w: o.w || this.w, h: o.h || this.h, alpha: o.alpha != null ? o.alpha : 1, blend: o.blend || null });
      return this;
    }
    clipStart(pts) { this.ops.push({ t: 'clip', pts }); return this; }
    clipEnd() { this.ops.push({ t: 'unclip' }); return this; }
  }

  /* Dibuja una lista de operaciones en un contexto 2D, escalando el mundo a píxeles.
     `limit` permite dibujar sólo las primeras N operaciones (animación de construcción). */
  function renderOps(ctx, pen, pxW, pxH, limit) {
    const s = pxW / pen.w;
    const sy = pxH / pen.h;
    ctx.save();
    ctx.scale(s, sy);
    const n = limit == null ? pen.ops.length : Math.min(limit, pen.ops.length);
    let clipDepth = 0;
    for (let i = 0; i < n; i++) {
      const op = pen.ops[i];
      if (op.t === 'bg') { ctx.fillStyle = op.fill; ctx.fillRect(0, 0, pen.w, pen.h); continue; }
      if (op.t === 'clip') {
        ctx.save(); clipDepth++;
        ctx.beginPath(); tracePoly(ctx, op.pts, true); ctx.clip(); continue;
      }
      if (op.t === 'unclip') { if (clipDepth > 0) { ctx.restore(); clipDepth--; } continue; }
      if (op.t === 'raster') { drawRaster(ctx, op); continue; }
      ctx.globalAlpha = op.alpha;
      ctx.globalCompositeOperation = op.blend || 'source-over';
      ctx.beginPath();
      switch (op.t) {
        case 'rect':
          if (op.r && ctx.roundRect) ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
          else ctx.rect(op.x, op.y, op.w, op.h);
          break;
        case 'circle': ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2); break;
        case 'arc':
          if (op.pie) ctx.moveTo(op.x, op.y);
          ctx.arc(op.x, op.y, op.r, op.a0, op.a1);
          if (op.pie) ctx.closePath();
          break;
        case 'path':
          if (op.smooth) traceSmooth(ctx, op.pts, op.closed); else tracePoly(ctx, op.pts, op.closed);
          break;
        case 'compound':
          for (const p of op.polys) tracePoly(ctx, p, true);
          break;
      }
      if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(op.t === 'compound' ? 'evenodd' : 'nonzero'); }
      if (op.stroke && op.lw > 0) {
        ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw; ctx.lineCap = op.cap; ctx.lineJoin = op.join; ctx.stroke();
      }
    }
    while (clipDepth-- > 0) ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function tracePoly(ctx, pts, closed) {
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (closed) ctx.closePath();
  }
  function traceSmooth(ctx, pts, closed) {
    const n = pts.length / 2;
    if (n < 3) return tracePoly(ctx, pts, closed);
    const P = (i) => { i = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)); return [pts[i * 2], pts[i * 2 + 1]]; };
    ctx.moveTo(...P(0));
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  }

  const rasterCache = new WeakMap();
  function rasterCanvas(op) {
    let c = rasterCache.get(op);
    if (!c) {
      c = document.createElement('canvas');
      c.width = op.rw; c.height = op.rh;
      c.getContext('2d').putImageData(new ImageData(op.data, op.rw, op.rh), 0, 0);
      rasterCache.set(op, c);
    }
    return c;
  }
  function drawRaster(ctx, op) {
    ctx.save();
    ctx.globalAlpha = op.alpha;
    ctx.globalCompositeOperation = op.blend || 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(rasterCanvas(op), op.x, op.y, op.w, op.h);
    ctx.restore();
  }

  /* Serializa a SVG (vector puro salvo capas raster, que se incrustan como PNG). */
  function toSVG(pen, pxW, pxH, meta = {}) {
    const f = (v) => Math.round(v * 100) / 100;
    const attrs = (op) => {
      let a = '';
      a += op.fill ? ` fill="${op.fill}"` : ' fill="none"';
      if (op.stroke && op.lw > 0) a += ` stroke="${op.stroke}" stroke-width="${f(op.lw)}" stroke-linecap="${op.cap}" stroke-linejoin="${op.join}"`;
      if (op.alpha < 1) a += ` opacity="${f(op.alpha)}"`;
      if (op.blend && op.blend !== 'source-over') a += ` style="mix-blend-mode:${op.blend === 'lighter' ? 'plus-lighter' : op.blend}"`;
      return a;
    };
    const ptsStr = (pts) => { let s = ''; for (let i = 0; i < pts.length; i += 2) s += (i ? ' ' : '') + f(pts[i]) + ',' + f(pts[i + 1]); return s; };
    const smoothD = (pts, closed) => {
      const n = pts.length / 2;
      const P = (i) => { i = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)); return [pts[i * 2], pts[i * 2 + 1]]; };
      let d = `M${f(pts[0])},${f(pts[1])}`;
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
      }
      return d + (closed ? 'Z' : '');
    };
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${f(pen.w)} ${f(pen.h)}">`);
    if (meta.title) out.push(`<title>${escapeXml(meta.title)}</title>`);
    if (meta.desc) out.push(`<desc>${escapeXml(meta.desc)}</desc>`);
    let clipId = 0, openGroups = 0;
    const defs = [];
    for (const op of pen.ops) {
      switch (op.t) {
        case 'bg': out.push(`<rect width="100%" height="100%" fill="${op.fill}"/>`); break;
        case 'rect': out.push(`<rect x="${f(op.x)}" y="${f(op.y)}" width="${f(op.w)}" height="${f(op.h)}"${op.r ? ` rx="${f(op.r)}"` : ''}${attrs(op)}/>`); break;
        case 'circle': out.push(`<circle cx="${f(op.x)}" cy="${f(op.y)}" r="${f(op.r)}"${attrs(op)}/>`); break;
        case 'arc': {
          const x0 = op.x + op.r * Math.cos(op.a0), y0 = op.y + op.r * Math.sin(op.a0);
          const x1 = op.x + op.r * Math.cos(op.a1), y1 = op.y + op.r * Math.sin(op.a1);
          const sweep = op.a1 - op.a0;
          if (Math.abs(sweep) >= Math.PI * 2 - 1e-6) { out.push(`<circle cx="${f(op.x)}" cy="${f(op.y)}" r="${f(op.r)}"${attrs(op)}/>`); break; }
          const large = Math.abs(sweep) > Math.PI ? 1 : 0;
          const d = (op.pie ? `M${f(op.x)},${f(op.y)}L` : 'M') + `${f(x0)},${f(y0)}A${f(op.r)},${f(op.r)} 0 ${large} ${sweep > 0 ? 1 : 0} ${f(x1)},${f(y1)}` + (op.pie ? 'Z' : '');
          out.push(`<path d="${d}"${attrs(op)}/>`);
          break;
        }
        case 'path':
          if (op.smooth) out.push(`<path d="${smoothD(op.pts, op.closed)}"${attrs(op)}/>`);
          else out.push(`<${op.closed ? 'polygon' : 'polyline'} points="${ptsStr(op.pts)}"${attrs(op)}/>`);
          break;
        case 'compound': {
          const d = op.polys.map((p) => 'M' + ptsStr(p).replace(/ /g, 'L') + 'Z').join('');
          out.push(`<path fill-rule="evenodd" d="${d}"${attrs(op)}/>`);
          break;
        }
        case 'raster': {
          const c = rasterCanvas(op);
          out.push(`<image x="${f(op.x)}" y="${f(op.y)}" width="${f(op.w)}" height="${f(op.h)}" preserveAspectRatio="none"${op.alpha < 1 ? ` opacity="${op.alpha}"` : ''} href="${c.toDataURL('image/png')}"/>`);
          break;
        }
        case 'clip': {
          const id = 'clip' + clipId++;
          defs.push(`<clipPath id="${id}"><polygon points="${ptsStr(op.pts)}"/></clipPath>`);
          out.push(`<g clip-path="url(#${id})">`); openGroups++;
          break;
        }
        case 'unclip': if (openGroups > 0) { out.push('</g>'); openGroups--; } break;
      }
    }
    while (openGroups-- > 0) out.push('</g>');
    if (defs.length) out.splice(meta.title ? 2 : 1, 0, `<defs>${defs.join('')}</defs>`);
    out.push('</svg>');
    return out.join('\n');
  }
  function escapeXml(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }

  /* ───────────── Geometría útil ───────────── */
  const Geo = {
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    /* recorta un polígono convexo por el semiplano donde (p - m)·n <= 0 */
    clipHalfPlane(poly, mx, my, nx, ny) {
      const out = [];
      const n = poly.length / 2;
      for (let i = 0; i < n; i++) {
        const ax = poly[i * 2], ay = poly[i * 2 + 1];
        const bx = poly[((i + 1) % n) * 2], by = poly[((i + 1) % n) * 2 + 1];
        const da = (ax - mx) * nx + (ay - my) * ny;
        const db = (bx - mx) * nx + (by - my) * ny;
        if (da <= 0) out.push(ax, ay);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db);
          out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
        }
      }
      return out;
    },
    centroid(poly) {
      let x = 0, y = 0, a = 0;
      const n = poly.length / 2;
      for (let i = 0; i < n; i++) {
        const x0 = poly[i * 2], y0 = poly[i * 2 + 1], x1 = poly[((i + 1) % n) * 2], y1 = poly[((i + 1) % n) * 2 + 1];
        const c = x0 * y1 - x1 * y0; a += c; x += (x0 + x1) * c; y += (y0 + y1) * c;
      }
      a *= 0.5;
      if (Math.abs(a) < 1e-9) return [poly[0], poly[1]];
      return [x / (6 * a), y / (6 * a)];
    },
    scalePoly(poly, cx, cy, k) {
      const out = new Array(poly.length);
      for (let i = 0; i < poly.length; i += 2) { out[i] = cx + (poly[i] - cx) * k; out[i + 1] = cy + (poly[i + 1] - cy) * k; }
      return out;
    },
    regular(cx, cy, r, sides, rot = 0) {
      const pts = [];
      for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      return pts;
    },
  };

  /* ───────────── Registro de generadores ───────────── */
  const generators = [];
  function register(def) { generators.push(def); }

  Object.assign(Telar, { hashString, makeRng, makeNoise, randomSeed, Color, Pen, renderOps, toSVG, Geo, generators, register });
})(window);
