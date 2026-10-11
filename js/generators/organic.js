/* Telar · generadores orgánicos: flujo, crestas, topografía, acuarela, árbol */
(function (Telar) {
  'use strict';
  const { register, Color, Geo } = Telar;

  /* ───────── Campo de flujo ───────── */
  register({
    id: 'flujo',
    name: 'Campo de flujo',
    family: 'Orgánico',
    desc: 'Miles de partículas siguen un campo de ruido y dejan su rastro como hilos.',
    params: [
      { key: 'count', label: 'Hilos', type: 'range', min: 50, max: 4000, step: 10, def: 1100 },
      { key: 'steps', label: 'Largo', type: 'range', min: 10, max: 500, step: 5, def: 140 },
      { key: 'stepLen', label: 'Paso', type: 'range', min: 0.5, max: 8, step: 0.1, def: 2.2 },
      { key: 'scale', label: 'Escala del ruido', type: 'range', min: 0.3, max: 10, step: 0.1, def: 2.4 },
      { key: 'octaves', label: 'Octavas', type: 'range', min: 1, max: 6, step: 1, def: 2 },
      { key: 'twist', label: 'Torsión', type: 'range', min: 0.2, max: 4, step: 0.05, def: 1.2 },
      { key: 'quantize', label: 'Ángulos cuantizados', type: 'range', min: 0, max: 12, step: 1, def: 0, hint: '0 = libre' },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0.2, max: 12, step: 0.1, def: 1.3 },
      { key: 'lwVar', label: 'Variación de grosor', type: 'range', min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: 'alpha', label: 'Opacidad', type: 'range', min: 0.05, max: 1, step: 0.05, def: 0.85 },
      { key: 'margin', label: 'Margen', type: 'range', min: 0, max: 0.3, step: 0.01, def: 0.06 },
      { key: 'start', label: 'Siembra', type: 'select', def: 'random', options: [['random', 'Aleatoria'], ['grid', 'Rejilla'], ['circle', 'Círculo'], ['edge', 'Borde izquierdo'], ['center', 'Centro']] },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'palette', options: [['palette', 'Paleta al azar'], ['angle', 'Por dirección'], ['position', 'Por posición'], ['zones', 'Por zonas de ruido']] },
      { key: 'smooth', label: 'Curvas suaves', type: 'toggle', def: true },
    ],
    draw({ pen, w, h, rng, noise, pal, p }) {
      pen.background(pal.bg);
      const m = p.margin * Math.min(w, h);
      const sc = p.scale / w;
      const zoneNoise = Telar.makeNoise(Telar.makeRng(rng.int(0, 1e9)));
      for (let i = 0; i < p.count; i++) {
        let x, y;
        switch (p.start) {
          case 'grid': {
            const side = Math.ceil(Math.sqrt(p.count * (w / h)));
            const rows = Math.ceil(p.count / side);
            x = m + ((i % side) + 0.5) * ((w - 2 * m) / side);
            y = m + (Math.floor(i / side) + 0.5) * ((h - 2 * m) / rows);
            break;
          }
          case 'circle': {
            const a = (i / p.count) * Math.PI * 2;
            const r = Math.min(w, h) * 0.32 + rng.gauss(0, 8);
            x = w / 2 + Math.cos(a) * r; y = h / 2 + Math.sin(a) * r; break;
          }
          case 'edge': x = m + rng.float(0, 4); y = rng.float(m, h - m); break;
          case 'center': x = w / 2 + rng.gauss(0, w * 0.06); y = h / 2 + rng.gauss(0, h * 0.06); break;
          default: x = rng.float(m, w - m); y = rng.float(m, h - m);
        }
        const pts = [x, y];
        let angSum = 0;
        for (let s = 0; s < p.steps; s++) {
          let a = noise.fbm(x * sc, y * sc, p.octaves) * Math.PI * 2 * p.twist;
          if (p.quantize > 0) { const q = (Math.PI * 2) / (p.quantize * 2); a = Math.round(a / q) * q; }
          angSum += a;
          x += Math.cos(a) * p.stepLen; y += Math.sin(a) * p.stepLen;
          if (x < m || x > w - m || y < m || y > h - m) break;
          if (s % 2 === 1 || p.steps < 40) pts.push(x, y);
        }
        if (pts.length < 6) continue;
        let color;
        const cols = pal.colors;
        if (p.colorMode === 'angle') color = Color.ramp(cols, ((angSum / (pts.length / 2)) / (Math.PI * 2 * p.twist) + 1) / 2);
        else if (p.colorMode === 'position') color = Color.ramp(cols, pts[1] / h * 0.6 + pts[0] / w * 0.4);
        else if (p.colorMode === 'zones') color = cols[Math.floor(((zoneNoise.n2(pts[0] * sc * 0.6, pts[1] * sc * 0.6) + 1) / 2) * cols.length) % cols.length];
        else color = rng.pick(cols);
        const lw = p.lw * (1 - p.lwVar + p.lwVar * rng.float(0.2, 2));
        pen.path(pts, { stroke: color, lw, alpha: p.alpha, smooth: p.smooth });
      }
    },
  });

  /* ───────── Crestas ───────── */
  register({
    id: 'crestas',
    name: 'Crestas',
    family: 'Orgánico',
    desc: 'Líneas apiladas que se levantan como señales o cordilleras y se ocultan unas a otras.',
    params: [
      { key: 'lines', label: 'Líneas', type: 'range', min: 6, max: 140, step: 1, def: 52 },
      { key: 'amp', label: 'Altura', type: 'range', min: 0, max: 400, step: 1, def: 120 },
      { key: 'scale', label: 'Escala del ruido', type: 'range', min: 0.3, max: 12, step: 0.1, def: 3.2 },
      { key: 'octaves', label: 'Octavas', type: 'range', min: 1, max: 6, step: 1, def: 3 },
      { key: 'focus', label: 'Concentración al centro', type: 'range', min: 0, max: 1, step: 0.05, def: 0.7 },
      { key: 'sharp', label: 'Picos', type: 'range', min: 1, max: 4, step: 0.1, def: 1.6 },
      { key: 'samples', label: 'Resolución', type: 'range', min: 30, max: 400, step: 5, def: 180 },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0.3, max: 8, step: 0.1, def: 1.8 },
      { key: 'margin', label: 'Margen', type: 'range', min: 0, max: 0.3, step: 0.01, def: 0.14 },
      { key: 'occlude', label: 'Ocultar líneas de atrás', type: 'toggle', def: true },
      { key: 'fillColor', label: 'Relleno de color', type: 'toggle', def: false },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'single', options: [['single', 'Una tinta'], ['ramp', 'Degradado'], ['random', 'Paleta al azar']] },
    ],
    draw({ pen, w, h, rng, noise, pal, p }) {
      pen.background(pal.bg);
      const mx = p.margin * w, my = p.margin * h;
      const top = my + p.amp * 0.6, bottom = h - my;
      const gap = (bottom - top) / Math.max(1, p.lines - 1);
      const ink = pal.colors[0];
      for (let i = 0; i < p.lines; i++) {
        const base = top + i * gap;
        const pts = [];
        for (let s = 0; s <= p.samples; s++) {
          const t = s / p.samples;
          const x = mx + t * (w - 2 * mx);
          const env = Math.pow(Math.sin(Math.PI * t), 1 + p.focus * 6) * p.focus + (1 - p.focus) * 0.35;
          let n = (noise.fbm(t * p.scale, i * 0.17, p.octaves) + 1) / 2;
          n = Math.pow(n, p.sharp);
          pts.push(x, base - n * p.amp * env);
        }
        let color = ink;
        if (p.colorMode === 'ramp') color = Color.ramp(pal.colors, i / Math.max(1, p.lines - 1));
        else if (p.colorMode === 'random') color = rng.pick(pal.colors);
        if (p.occlude || p.fillColor) {
          const poly = pts.slice();
          poly.push(w - mx, base + gap * 0.5 + 2, mx, base + gap * 0.5 + 2);
          pen.poly(poly, { fill: p.fillColor ? Color.mix(pal.bg, color, 0.25) : pal.bg });
        }
        pen.path(pts, { stroke: color, lw: p.lw });
      }
    },
  });

  /* ───────── Topografía ───────── */
  register({
    id: 'topografia',
    name: 'Topografía',
    family: 'Orgánico',
    desc: 'Curvas de nivel de un terreno imaginario, con bandas de color opcionales.',
    params: [
      { key: 'levels', label: 'Niveles', type: 'range', min: 3, max: 50, step: 1, def: 18 },
      { key: 'scale', label: 'Escala', type: 'range', min: 0.3, max: 8, step: 0.1, def: 1.9 },
      { key: 'octaves', label: 'Octavas', type: 'range', min: 1, max: 7, step: 1, def: 4 },
      { key: 'warp', label: 'Deformación', type: 'range', min: 0, max: 3, step: 0.05, def: 0.8 },
      { key: 'res', label: 'Detalle de la malla', type: 'range', min: 40, max: 320, step: 10, def: 170 },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0, max: 6, step: 0.1, def: 1.2 },
      { key: 'major', label: 'Curva maestra cada', type: 'range', min: 0, max: 10, step: 1, def: 5, hint: '0 = ninguna' },
      { key: 'bands', label: 'Bandas de color', type: 'toggle', def: true },
      { key: 'bandAlpha', label: 'Intensidad de bandas', type: 'range', min: 0.1, max: 1, step: 0.05, def: 0.55 },
      { key: 'lineColor', label: 'Color de línea', type: 'select', def: 'ink', options: [['ink', 'Tinta'], ['ramp', 'Degradado'], ['bg', 'Fondo (grabado)']] },
    ],
    draw({ pen, w, h, rng, noise, pal, p, res }) {
      pen.background(pal.bg);
      const sc = p.scale / Math.max(w, h);
      const field = (x, y) => {
        let wx = x * sc, wy = y * sc;
        if (p.warp > 0) {
          const qx = noise.fbm(wx + 5.2, wy + 1.3, 3), qy = noise.fbm(wx + 1.7, wy + 9.2, 3);
          wx += p.warp * qx; wy += p.warp * qy;
        }
        return (noise.fbm(wx, wy, p.octaves) + 1) / 2;
      };
      // Normaliza el rango del campo para que las bandas usen toda la paleta
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < 400; i++) { const v = field(rng.float(0, w), rng.float(0, h)); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const norm = (v) => Geo.clamp((v - lo) / (hi - lo || 1), 0, 1);
      const ramp = [pal.bg, ...pal.colors];

      if (p.bands) {
        const rw = Math.round(Math.min(res, 1400)), rh = Math.round(rw * h / w);
        const data = new Uint8ClampedArray(rw * rh * 4);
        const rgb = Array.from({ length: p.levels + 1 }, (_, k) => Color.hexToRgb(Color.mix(pal.bg, Color.ramp(ramp, k / p.levels), p.bandAlpha)));
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
          const v = norm(field((i + 0.5) * w / rw, (j + 0.5) * h / rh));
          const c = rgb[Math.min(p.levels, Math.floor(v * p.levels))];
          const o = (j * rw + i) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
        }
        pen.raster(rw, rh, data);
      }
      if (p.lw <= 0) return;

      const gx = p.res, gy = Math.round(p.res * h / w);
      const dx = w / gx, dy = h / gy;
      const grid = new Float32Array((gx + 1) * (gy + 1));
      for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) grid[j * (gx + 1) + i] = norm(field(i * dx, j * dy));
      for (let L = 1; L < p.levels; L++) {
        const iso = L / p.levels;
        const segs = marchingSquares(grid, gx, gy, dx, dy, iso);
        const lines = chainSegments(segs);
        let color = pal.colors[0];
        if (p.lineColor === 'ramp') color = Color.ramp(pal.colors, iso);
        if (p.lineColor === 'bg') color = Color.mix(pal.bg, '#000000', Color.luminance(pal.bg) > 0.5 ? 0.35 : 0) ;
        if (p.lineColor === 'bg' && Color.luminance(pal.bg) <= 0.5) color = Color.mix(pal.bg, '#ffffff', 0.4);
        const isMajor = p.major > 0 && L % p.major === 0;
        for (const ln of lines) pen.path(ln.pts, { stroke: color, lw: p.lw * (isMajor ? 2.2 : 1), closed: ln.closed, alpha: isMajor ? 1 : 0.85 });
      }
    },
  });

  function marchingSquares(grid, gx, gy, dx, dy, iso) {
    const segs = [];
    const W = gx + 1;
    const lerp = (a, b) => (iso - a) / (b - a);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const a = grid[j * W + i], b = grid[j * W + i + 1], c = grid[(j + 1) * W + i + 1], d = grid[(j + 1) * W + i];
      let idx = 0;
      if (a > iso) idx |= 8; if (b > iso) idx |= 4; if (c > iso) idx |= 2; if (d > iso) idx |= 1;
      if (idx === 0 || idx === 15) continue;
      const x = i * dx, y = j * dy;
      const T = [x + dx * lerp(a, b), y], R = [x + dx, y + dy * lerp(b, c)], B = [x + dx * lerp(d, c), y + dy], L = [x, y + dy * lerp(a, d)];
      switch (idx) {
        case 1: case 14: segs.push([L, B]); break;
        case 2: case 13: segs.push([B, R]); break;
        case 3: case 12: segs.push([L, R]); break;
        case 4: case 11: segs.push([T, R]); break;
        case 5: segs.push([L, T], [B, R]); break;
        case 6: case 9: segs.push([T, B]); break;
        case 7: case 8: segs.push([L, T]); break;
        case 10: segs.push([L, B], [T, R]); break;
      }
    }
    return segs;
  }

  /* Une segmentos sueltos en polilíneas continuas (mejor SVG y animación). */
  function chainSegments(segs) {
    const key = (pt) => Math.round(pt[0] * 100) + ',' + Math.round(pt[1] * 100);
    const map = new Map();
    const used = new Uint8Array(segs.length);
    segs.forEach((s, i) => {
      for (const e of [0, 1]) {
        const k = key(s[e]);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(i);
      }
    });
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const chain = [segs[i][0], segs[i][1]];
      for (const dir of [1, -1]) {
        for (;;) {
          const end = dir === 1 ? chain[chain.length - 1] : chain[0];
          const cand = (map.get(key(end)) || []).find((j) => !used[j]);
          if (cand == null) break;
          used[cand] = 1;
          const s = segs[cand];
          const nxt = key(s[0]) === key(end) ? s[1] : s[0];
          if (dir === 1) chain.push(nxt); else chain.unshift(nxt);
        }
      }
      const closed = chain.length > 3 && key(chain[0]) === key(chain[chain.length - 1]);
      if (closed) chain.pop();
      out.push({ pts: chain.flat(), closed });
    }
    return out;
  }
  Telar.marchingSquares = marchingSquares;
  Telar.chainSegments = chainSegments;

  /* ───────── Acuarela ───────── */
  register({
    id: 'acuarela',
    name: 'Acuarela',
    family: 'Orgánico',
    desc: 'Manchas translúcidas apiladas en decenas de capas deformadas, como pigmento sobre papel.',
    params: [
      { key: 'blobs', label: 'Manchas', type: 'range', min: 1, max: 16, step: 1, def: 6 },
      { key: 'layers', label: 'Capas por mancha', type: 'range', min: 5, max: 80, step: 1, def: 34 },
      { key: 'alpha', label: 'Opacidad por capa', type: 'range', min: 0.01, max: 0.15, step: 0.005, def: 0.04 },
      { key: 'size', label: 'Tamaño', type: 'range', min: 0.05, max: 0.7, step: 0.01, def: 0.28 },
      { key: 'spread', label: 'Expansión', type: 'range', min: 0.2, max: 3, step: 0.05, def: 1.1 },
      { key: 'detail', label: 'Detalle del borde', type: 'range', min: 3, max: 7, step: 1, def: 5 },
      { key: 'sides', label: 'Lados base', type: 'range', min: 3, max: 14, step: 1, def: 9 },
      { key: 'blend', label: 'Mezcla', type: 'select', def: 'multiply', options: [['source-over', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Trama'], ['lighter', 'Luz']] },
      { key: 'layout', label: 'Composición', type: 'select', def: 'scatter', options: [['scatter', 'Dispersa'], ['row', 'Horizonte'], ['center', 'Concéntrica'], ['grid', 'Rejilla']] },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const deform = (pts, depth, variance) => {
        let cur = pts;
        for (let d = 0; d < depth; d++) {
          const nx = [];
          const n = cur.length / 3;
          for (let i = 0; i < n; i++) {
            const ax = cur[i * 3], ay = cur[i * 3 + 1], av = cur[i * 3 + 2];
            const j = (i + 1) % n;
            const bx = cur[j * 3], by = cur[j * 3 + 1], bv = cur[j * 3 + 2];
            const len = Math.hypot(bx - ax, by - ay);
            const vv = (av + bv) / 2;
            const ang = Math.atan2(by - ay, bx - ax) - Math.PI / 2 + rng.gauss(0, 0.5);
            const off = rng.gauss(0, len * variance * vv);
            nx.push(ax, ay, av, (ax + bx) / 2 + Math.cos(ang) * off, (ay + by) / 2 + Math.sin(ang) * off, vv * rng.float(0.6, 1.4));
          }
          cur = nx;
        }
        return cur;
      };
      const strip = (pts) => { const o = []; for (let i = 0; i < pts.length; i += 3) o.push(pts[i], pts[i + 1]); return o; };
      const S = Math.min(w, h);
      for (let b = 0; b < p.blobs; b++) {
        let cx, cy;
        if (p.layout === 'row') { cx = ((b + 0.5) / p.blobs) * w; cy = h * 0.5 + rng.gauss(0, h * 0.06); }
        else if (p.layout === 'center') { cx = w / 2 + rng.gauss(0, S * 0.03); cy = h / 2 + rng.gauss(0, S * 0.03); }
        else if (p.layout === 'grid') { const c = Math.ceil(Math.sqrt(p.blobs)); cx = ((b % c) + 0.5) / c * w; cy = (Math.floor(b / c) + 0.5) / Math.ceil(p.blobs / c) * h; }
        else { cx = rng.float(0.15, 0.85) * w; cy = rng.float(0.15, 0.85) * h; }
        const r = S * p.size * (p.layout === 'center' ? (1 - b / p.blobs) * 1.2 + 0.2 : rng.float(0.6, 1.2));
        const color = pal.colors[b % pal.colors.length];
        const base = [];
        for (let i = 0; i < p.sides; i++) {
          const a = (i / p.sides) * Math.PI * 2;
          base.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rng.float(0.5, 1.5));
        }
        const shaped = deform(base, 2, 0.6 * p.spread);
        for (let l = 0; l < p.layers; l++) {
          const poly = strip(deform(shaped, p.detail - 1, 0.45 * p.spread));
          pen.poly(poly, { fill: Color.jitter(color, rng, 0.02), alpha: p.alpha, blend: p.blend });
        }
      }
    },
  });

  /* ───────── Árbol ───────── */
  register({
    id: 'arbol',
    name: 'Árbol',
    family: 'Orgánico',
    desc: 'Ramas recursivas que se bifurcan con viento y azar, con hojas en las puntas.',
    params: [
      { key: 'trees', label: 'Árboles', type: 'range', min: 1, max: 7, step: 1, def: 1 },
      { key: 'depth', label: 'Profundidad', type: 'range', min: 3, max: 13, step: 1, def: 10 },
      { key: 'angle', label: 'Apertura', type: 'range', min: 4, max: 70, step: 1, def: 24 },
      { key: 'ratio', label: 'Reducción', type: 'range', min: 0.5, max: 0.88, step: 0.01, def: 0.74 },
      { key: 'chaos', label: 'Azar', type: 'range', min: 0, max: 1, step: 0.05, def: 0.45 },
      { key: 'wind', label: 'Viento', type: 'range', min: -40, max: 40, step: 1, def: 6 },
      { key: 'trunk', label: 'Tronco', type: 'range', min: 1, max: 40, step: 0.5, def: 14 },
      { key: 'size', label: 'Altura', type: 'range', min: 0.1, max: 0.4, step: 0.01, def: 0.25 },
      { key: 'leaves', label: 'Hojas', type: 'toggle', def: true },
      { key: 'leafSize', label: 'Tamaño de hoja', type: 'range', min: 1, max: 30, step: 0.5, def: 7 },
      { key: 'ground', label: 'Suelo', type: 'toggle', def: true },
      { key: 'moon', label: 'Astro', type: 'toggle', def: true },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const ink = pal.colors[0];
      const groundY = h * 0.86;
      if (p.moon) {
        const mc = pal.colors[pal.colors.length - 1];
        pen.circle(w * rng.float(0.65, 0.82), h * rng.float(0.16, 0.26), Math.min(w, h) * rng.float(0.06, 0.1), { fill: mc, alpha: 0.9 });
      }
      const branches = [], leaves = [];
      const grow = (x, y, len, ang, wdt, d) => {
        const bend = (p.wind * Math.PI) / 180 * (1 - d / p.depth) * 0.6;
        const a = ang + bend;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        const mx = (x + x2) / 2 + rng.gauss(0, len * 0.08 * p.chaos), my = (y + y2) / 2 + rng.gauss(0, len * 0.08 * p.chaos);
        branches.push({ pts: [x, y, mx, my, x2, y2], lw: Math.max(0.4, wdt), d });
        if (d <= 1) { leaves.push([x2, y2]); return; }
        const spread = (p.angle * Math.PI) / 180;
        const kids = rng.chance(p.chaos * 0.35) ? 3 : 2;
        for (let k = 0; k < kids; k++) {
          const off = kids === 2 ? (k === 0 ? -spread : spread) : (k - 1) * spread;
          const jit = rng.gauss(0, spread * 0.5 * p.chaos);
          const nl = len * p.ratio * rng.float(1 - p.chaos * 0.3, 1 + p.chaos * 0.1);
          if (d < p.depth - 2 && rng.chance(p.chaos * 0.12)) { leaves.push([x2, y2]); continue; }
          grow(x2, y2, nl, a + off + jit, wdt * 0.7, d - 1);
        }
      };
      for (let t = 0; t < p.trees; t++) {
        const x = p.trees === 1 ? w / 2 : w * (0.12 + 0.76 * (t / (p.trees - 1))) + rng.gauss(0, w * 0.02);
        const scale = p.trees === 1 ? 1 : rng.float(0.55, 1);
        grow(x, groundY, h * p.size * scale, -Math.PI / 2 + rng.gauss(0, 0.05), p.trunk * scale, p.depth);
      }
      if (p.ground) {
        const pts = [];
        for (let i = 0; i <= 60; i++) pts.push((i / 60) * w, groundY + Math.sin(i * 0.35 + rng.float(0, 6)) * 3 + rng.float(-1, 1));
        pts.push(w, h, 0, h);
        pen.poly(pts, { fill: ink, alpha: 0.92 });
      }
      branches.sort((a, b) => b.d - a.d);
      for (const b of branches) pen.path(b.pts, { stroke: ink, lw: b.lw, smooth: true });
      if (p.leaves) {
        const leafCols = pal.colors.length > 1 ? pal.colors.slice(1) : pal.colors;
        for (const [x, y] of leaves) {
          const n = rng.int(1, 3);
          for (let k = 0; k < n; k++) pen.circle(x + rng.gauss(0, p.leafSize), y + rng.gauss(0, p.leafSize), p.leafSize * rng.float(0.4, 1.1), { fill: rng.pick(leafCols), alpha: rng.float(0.55, 0.95) });
        }
      }
    },
  });
})(window.Telar);
