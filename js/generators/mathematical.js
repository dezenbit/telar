/* Telar · generadores matemáticos: atractor, mosaico Voronoi, empaquetado, tejido modular */
(function (Telar) {
  'use strict';
  const { register, Color, Geo } = Telar;

  /* ───────── Atractor extraño ───────── */
  const ATTRACTORS = {
    clifford: { f: (x, y, a, b, c, d) => [Math.sin(a * y) + c * Math.cos(a * x), Math.sin(b * x) + d * Math.cos(b * y)], range: 2 },
    dejong: { f: (x, y, a, b, c, d) => [Math.sin(a * y) - Math.cos(b * x), Math.sin(c * x) - Math.cos(d * y)], range: 3 },
    svensson: { f: (x, y, a, b, c, d) => [d * Math.sin(a * x) - Math.sin(b * y), c * Math.cos(a * x) + Math.cos(b * y)], range: 2.5 },
    bedhead: { f: (x, y, a, b) => [Math.sin((x * y) / b) * y + Math.cos(a * x - y), x + Math.sin(y) / b], range: 1 },
  };

  const PRESETS = {
    clifford: [[-1.4, 1.6, 1.0, 0.7], [1.7, 1.7, 0.6, 1.2], [-1.7, 1.3, -0.1, -1.2], [-1.8, -2.0, -0.5, -0.9], [1.5, -1.8, 1.6, 0.9], [-1.24, -1.25, -1.81, -1.91]],
    dejong: [[-2.24, 0.43, -0.65, -2.43], [2.01, -2.53, 1.61, -0.33], [1.4, -2.3, 2.4, -2.1], [-2.7, -0.09, -0.86, -2.2], [-0.827, -1.637, 1.659, -0.943], [-2.0, -2.0, -1.2, 2.0]],
    svensson: [[1.5, -1.8, 1.6, 0.9], [-0.91, -1.29, -1.97, -1.56], [1.4, 1.56, 1.4, -6.56], [-1.78, 1.29, -0.09, -1.18]],
    bedhead: [[-0.81, -0.92, 0, 0], [-0.64, 0.76, 0, 0], [0.06, 0.98, 0, 0], [-0.67, 0.83, 0, 0], [0.65, 0.74, 0, 0]],
  };

  register({
    id: 'atractor',
    name: 'Atractor extraño',
    family: 'Matemático',
    desc: 'Millones de iteraciones de un sistema caótico acumuladas como densidad de luz.',
    params: [
      { key: 'type', label: 'Sistema', type: 'select', def: 'clifford', options: [['clifford', 'Clifford'], ['dejong', 'De Jong'], ['svensson', 'Svensson'], ['bedhead', 'Bedhead']] },
      { key: 'iters', label: 'Iteraciones (millones)', type: 'range', min: 0.2, max: 6, step: 0.1, def: 2 },
      { key: 'gamma', label: 'Exposición', type: 'range', min: 0.1, max: 1.5, step: 0.01, def: 0.6 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.4, max: 2, step: 0.01, def: 0.92 },
      { key: 'rotate', label: 'Rotación', type: 'range', min: 0, max: 360, step: 1, def: 0 },
      { key: 'drift', label: 'Variación', type: 'range', min: -1, max: 1, step: 0.01, def: 0, hint: 'mueve los coeficientes' },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'density', options: [['density', 'Por densidad'], ['velocity', 'Por velocidad'], ['mono', 'Una tinta']] },
    ],
    draw({ pen, w, h, rng, pal, p, res }) {
      pen.background(pal.bg);
      const A = ATTRACTORS[p.type];
      let a, b, c, d, bounds;
      // Parte de coeficientes conocidos por su belleza y los perturba con la semilla
      const presets = PRESETS[p.type];
      const base = rng.pick(presets);
      for (let tries = 0; tries < 30; tries++) {
        const j = tries === 0 ? 0.06 : 0.02;
        [a, b, c, d] = base.map((v) => v + rng.float(-j, j));
        a += p.drift * 0.3; b -= p.drift * 0.2; c += p.drift * 0.12;
        bounds = probe(A.f, a, b, c, d);
        if (bounds && bounds.cells > 220) break;
      }
      if (!bounds) return;
      const rw = Math.round(Math.min(res, 2400)), rh = Math.round(rw * h / w);
      const dens = new Float32Array(rw * rh);
      const vel = p.colorMode === 'velocity' ? new Float32Array(rw * rh) : null;
      const cxw = (bounds.minX + bounds.maxX) / 2, cyw = (bounds.minY + bounds.maxY) / 2;
      const span = Math.max(bounds.maxX - bounds.minX, (bounds.maxY - bounds.minY) * (w / h));
      const k = (rw / span) * 0.9 * p.zoom;
      const rot = (p.rotate * Math.PI) / 180, cr = Math.cos(rot), sr = Math.sin(rot);
      let x = 0.1, y = 0.1;
      const N = Math.floor(p.iters * 1e6);
      for (let i = 0; i < N; i++) {
        const nx = A.f(x, y, a, b, c, d);
        const vx = nx[0] - x, vy = nx[1] - y;
        x = nx[0]; y = nx[1];
        if (i < 100) continue;
        const ux = (x - cxw) * cr - (y - cyw) * sr, uy = (x - cxw) * sr + (y - cyw) * cr;
        const px = Math.floor(rw / 2 + ux * k), py = Math.floor(rh / 2 + uy * k);
        if (px < 0 || py < 0 || px >= rw || py >= rh) continue;
        const idx = py * rw + px;
        dens[idx] += 1;
        if (vel) vel[idx] += Math.hypot(vx, vy);
      }
      let max = 0;
      for (let i = 0; i < dens.length; i++) if (dens[i] > max) max = dens[i];
      const lmax = Math.log(1 + max);
      const bgRgb = Color.hexToRgb(pal.bg);
      const LUT = 256;
      const lut = [];
      const ramp = p.colorMode === 'mono' ? [pal.bg, pal.colors[0]] : [pal.bg, ...pal.colors];
      for (let i = 0; i < LUT; i++) lut.push(Color.hexToRgb(Color.ramp(ramp, i / (LUT - 1))));
      const data = new Uint8ClampedArray(rw * rh * 4);
      for (let i = 0; i < dens.length; i++) {
        const o = i * 4;
        if (dens[i] === 0) { data[o] = bgRgb[0]; data[o + 1] = bgRgb[1]; data[o + 2] = bgRgb[2]; data[o + 3] = 255; continue; }
        const t = Math.pow(Math.log(1 + dens[i]) / lmax, p.gamma);
        let col;
        if (vel) {
          const v = Geo.clamp(vel[i] / dens[i] / (A.range * 1.2), 0, 1);
          const hue = lut[Math.floor((0.25 + v * 0.75) * (LUT - 1))];
          col = [bgRgb[0] + (hue[0] - bgRgb[0]) * t, bgRgb[1] + (hue[1] - bgRgb[1]) * t, bgRgb[2] + (hue[2] - bgRgb[2]) * t];
        } else col = lut[Math.min(LUT - 1, Math.floor(t * (LUT - 1)))];
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
      pen.raster(rw, rh, data);
    },
  });

  function probe(f, a, b, c, d) {
    let x = 0.1, y = 0.1, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const seen = new Set();
    for (let i = 0; i < 6000; i++) {
      [x, y] = f(x, y, a, b, c, d);
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e4) return null;
      if (i < 50) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const sx = (maxX - minX) || 1, sy = (maxY - minY) || 1;
    x = 0.1; y = 0.1;
    for (let i = 0; i < 6000; i++) { [x, y] = f(x, y, a, b, c, d); seen.add(Math.floor(((x - minX) / sx) * 30) * 64 + Math.floor(((y - minY) / sy) * 30)); }
    return { minX, maxX, minY, maxY, cells: seen.size };
  }

  /* ───────── Mosaico Voronoi ───────── */
  register({
    id: 'voronoi',
    name: 'Mosaico Voronoi',
    family: 'Matemático',
    desc: 'Celdas que reparten el plano según el punto más cercano; con relajación se vuelven panal.',
    params: [
      { key: 'sites', label: 'Celdas', type: 'range', min: 6, max: 900, step: 1, def: 180 },
      { key: 'relax', label: 'Relajación', type: 'range', min: 0, max: 8, step: 1, def: 2 },
      { key: 'gap', label: 'Junta', type: 'range', min: 0, max: 16, step: 0.25, def: 3 },
      { key: 'dist', label: 'Distribución', type: 'select', def: 'uniform', options: [['uniform', 'Uniforme'], ['cluster', 'Agrupada'], ['radial', 'Radial'], ['gradient', 'Degradada']] },
      { key: 'style', label: 'Estilo', type: 'select', def: 'fill', options: [['fill', 'Relleno'], ['outline', 'Contorno'], ['stained', 'Vitral'], ['nested', 'Anidado'], ['dots', 'Núcleos']] },
      { key: 'smooth', label: 'Esquinas suaves', type: 'toggle', def: true },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'random', options: [['random', 'Al azar'], ['gradient', 'Degradado'], ['noise', 'Por ruido']] },
    ],
    draw({ pen, w, h, rng, noise, pal, p }) {
      pen.background(pal.bg);
      let pts = [];
      for (let i = 0; i < p.sites; i++) {
        let x, y;
        if (p.dist === 'cluster') { const cx = rng.pick([0.3, 0.5, 0.7]) * w, cy = rng.pick([0.35, 0.65]) * h; x = cx + rng.gauss(0, w * 0.12); y = cy + rng.gauss(0, h * 0.12); }
        else if (p.dist === 'radial') { const a = rng.float(0, Math.PI * 2), r = Math.pow(rng.next(), 1.8) * Math.hypot(w, h) * 0.5; x = w / 2 + Math.cos(a) * r; y = h / 2 + Math.sin(a) * r; }
        else if (p.dist === 'gradient') { x = Math.pow(rng.next(), 2.2) * w; y = rng.float(0, h); }
        else { x = rng.float(0, w); y = rng.float(0, h); }
        pts.push([Geo.clamp(x, 1, w - 1), Geo.clamp(y, 1, h - 1)]);
      }
      let cells = voronoi(pts, w, h);
      for (let r = 0; r < p.relax; r++) {
        pts = cells.map((c, i) => (c.length >= 6 ? Geo.centroid(c) : pts[i]));
        cells = voronoi(pts, w, h);
      }
      const dark = Color.luminance(pal.bg) < 0.4;
      cells.forEach((cell, i) => {
        if (cell.length < 6) return;
        const [cx, cy] = Geo.centroid(cell);
        let color;
        if (p.colorMode === 'gradient') color = Color.ramp(pal.colors, (cx / w) * 0.7 + (cy / h) * 0.3);
        else if (p.colorMode === 'noise') color = pal.colors[Math.floor(((noise.n2(cx / w * 2.5, cy / h * 2.5) + 1) / 2) * pal.colors.length) % pal.colors.length];
        else color = rng.pick(pal.colors);
        const size = Math.sqrt(polyArea(cell));
        const inset = Geo.clamp(1 - p.gap / Math.max(size * 0.5, 1), 0.05, 1);
        const poly = Geo.scalePoly(cell, cx, cy, inset);
        switch (p.style) {
          case 'outline': pen.poly(poly, { stroke: color, lw: Math.max(1, p.gap * 0.5), smooth: p.smooth }); break;
          case 'stained':
            pen.poly(poly, { fill: color, smooth: p.smooth, alpha: 0.92 });
            pen.poly(Geo.scalePoly(cell, cx, cy, inset * 0.55), { fill: Color.mix(color, dark ? '#ffffff' : '#ffffff', 0.25), alpha: 0.5, smooth: true });
            break;
          case 'nested':
            for (let k = 0; k < 4; k++) pen.poly(Geo.scalePoly(cell, cx, cy, inset * (1 - k * 0.22)), { fill: k % 2 ? pal.bg : color, smooth: p.smooth });
            break;
          case 'dots':
            pen.poly(poly, { stroke: color, lw: 1, smooth: p.smooth, alpha: 0.6 });
            pen.circle(cx, cy, Math.max(1.5, size * 0.12), { fill: color });
            break;
          default: pen.poly(poly, { fill: color, smooth: p.smooth });
        }
      });
      if (p.style === 'stained') for (const cell of cells) if (cell.length >= 6) pen.poly(cell, { stroke: dark ? '#000000' : '#1a1a1a', lw: Math.max(1.5, p.gap), alpha: 0.85 });
    },
  });

  function polyArea(poly) {
    let a = 0; const n = poly.length / 2;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1]; }
    return Math.abs(a / 2);
  }

  /* Voronoi por recorte de semiplanos, con vecinos ordenados por distancia y corte temprano. */
  function voronoi(pts, w, h) {
    const n = pts.length;
    // rejilla para buscar vecinos cercanos primero
    const cell = Math.sqrt((w * h) / Math.max(1, n)) * 1.2;
    const gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1;
    const grid = Array.from({ length: gw * gh }, () => []);
    pts.forEach(([x, y], i) => grid[Math.floor(Geo.clamp(y, 0, h - 1) / cell) * gw + Math.floor(Geo.clamp(x, 0, w - 1) / cell)].push(i));
    const out = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[i];
      let poly = [0, 0, w, 0, w, h, 0, h];
      const gx = Math.floor(Geo.clamp(px, 0, w - 1) / cell), gy = Math.floor(Geo.clamp(py, 0, h - 1) / cell);
      for (let ring = 0; ring < Math.max(gw, gh); ring++) {
        // radio máximo actual del polígono
        let maxR = 0;
        for (let k = 0; k < poly.length; k += 2) maxR = Math.max(maxR, Math.hypot(poly[k] - px, poly[k + 1] - py));
        if ((ring - 1) * cell > maxR * 2) break;
        for (let yy = gy - ring; yy <= gy + ring; yy++) for (let xx = gx - ring; xx <= gx + ring; xx++) {
          if (Math.max(Math.abs(yy - gy), Math.abs(xx - gx)) !== ring) continue;
          if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
          for (const j of grid[yy * gw + xx]) {
            if (j === i) continue;
            const [qx, qy] = pts[j];
            const nx = qx - px, ny = qy - py;
            if (nx === 0 && ny === 0) continue;
            poly = Geo.clipHalfPlane(poly, (px + qx) / 2, (py + qy) / 2, nx, ny);
            if (poly.length < 6) break;
          }
        }
        if (poly.length < 6) break;
      }
      out.push(poly);
    }
    return out;
  }
  Telar.voronoi = voronoi;

  /* ───────── Empaquetado de círculos ───────── */
  register({
    id: 'circulos',
    name: 'Empaquetado de círculos',
    family: 'Matemático',
    desc: 'Círculos que crecen hasta tocarse sin superponerse, del más grande al más pequeño.',
    params: [
      { key: 'attempts', label: 'Intentos', type: 'range', min: 300, max: 40000, step: 100, def: 9000 },
      { key: 'minR', label: 'Radio mínimo', type: 'range', min: 0.5, max: 30, step: 0.5, def: 2 },
      { key: 'maxR', label: 'Radio máximo', type: 'range', min: 5, max: 300, step: 1, def: 110 },
      { key: 'pad', label: 'Separación', type: 'range', min: 0, max: 16, step: 0.25, def: 2.5 },
      { key: 'style', label: 'Estilo', type: 'select', def: 'mixed', options: [['fill', 'Relleno'], ['rings', 'Anillos'], ['outline', 'Contorno'], ['mixed', 'Mezcla'], ['planets', 'Planetas']] },
      { key: 'shape', label: 'Contenedor', type: 'select', def: 'rect', options: [['rect', 'Lienzo'], ['circle', 'Círculo'], ['ring', 'Anillo']] },
      { key: 'decay', label: 'Tamaño decreciente', type: 'toggle', def: true },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'random', options: [['random', 'Al azar'], ['size', 'Por tamaño'], ['radial', 'Radial']] },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const S = Math.min(w, h);
      const cx = w / 2, cy = h / 2;
      const inside = (x, y) => {
        if (p.shape === 'circle') return S * 0.45 - Math.hypot(x - cx, y - cy);
        if (p.shape === 'ring') { const d = Math.hypot(x - cx, y - cy); return Math.min(S * 0.46 - d, d - S * 0.2); }
        return Math.min(x, y, w - x, h - y);
      };
      const cellSize = p.maxR * 2 + p.pad;
      const gw = Math.ceil(w / cellSize) + 1;
      const grid = new Map();
      const circles = [];
      for (let t = 0; t < p.attempts; t++) {
        const x = rng.float(0, w), y = rng.float(0, h);
        let r = inside(x, y) - p.pad;
        if (r < p.minR) continue;
        const limit = p.decay ? p.minR + (p.maxR - p.minR) * Math.pow(1 - t / p.attempts, 2) : p.maxR;
        r = Math.min(r, limit);
        const gx = Math.floor(x / cellSize), gy = Math.floor(y / cellSize);
        for (let yy = gy - 1; yy <= gy + 1 && r >= p.minR; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
          const list = grid.get(yy * gw + xx);
          if (!list) continue;
          for (const c of list) {
            const d = Math.hypot(c[0] - x, c[1] - y) - c[2] - p.pad;
            if (d < r) r = d;
            if (r < p.minR) break;
          }
        }
        if (r < p.minR) continue;
        const c = [x, y, r];
        circles.push(c);
        const key = gy * gw + gx;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(c);
      }
      circles.sort((a, b) => b[2] - a[2]);
      const maxSeen = circles.length ? circles[0][2] : 1;
      for (const [x, y, r] of circles) {
        let color;
        if (p.colorMode === 'size') color = Color.ramp(pal.colors, r / maxSeen);
        else if (p.colorMode === 'radial') color = Color.ramp(pal.colors, Math.hypot(x - cx, y - cy) / (Math.hypot(w, h) / 2));
        else color = rng.pick(pal.colors);
        let style = p.style;
        if (style === 'mixed') style = rng.pick(['fill', 'fill', 'rings', 'outline']);
        if (style === 'fill') pen.circle(x, y, r, { fill: color });
        else if (style === 'outline') pen.circle(x, y, Math.max(0.5, r - 0.75), { stroke: color, lw: 1.5 });
        else if (style === 'rings') {
          const step = Math.max(2.5, r / rng.int(3, 7));
          for (let rr = r; rr > 0.5; rr -= step) pen.circle(x, y, rr, { fill: rr === r ? color : null, stroke: rr === r ? null : pal.bg, lw: step * 0.35 });
        } else if (style === 'planets') {
          pen.circle(x, y, r, { fill: color });
          pen.circle(x - r * 0.3, y - r * 0.3, r * 0.45, { fill: '#ffffff', alpha: 0.18 });
          if (r > 14 && rng.chance(0.25)) pen.arc(x, y, r * 1.5, rng.float(0, 6), rng.float(7, 9), { stroke: color, lw: 1.2, alpha: 0.7 });
        }
      }
    },
  });

  /* ───────── Tejido modular ───────── */
  register({
    id: 'tejido',
    name: 'Tejido modular',
    family: 'Matemático',
    desc: 'Hilos tensados entre clavos alrededor de una figura, unidos por aritmética modular.',
    params: [
      { key: 'points', label: 'Clavos', type: 'range', min: 12, max: 600, step: 1, def: 240 },
      { key: 'mult', label: 'Multiplicador', type: 'range', min: 1.5, max: 120, step: 0.01, def: 2 },
      { key: 'shape', label: 'Figura', type: 'select', def: 'circle', options: [['circle', 'Círculo'], ['lissajous', 'Lissajous'], ['polygon', 'Polígono'], ['rose', 'Rosa']] },
      { key: 'freqA', label: 'Frecuencia A', type: 'range', min: 1, max: 9, step: 1, def: 3 },
      { key: 'freqB', label: 'Frecuencia B', type: 'range', min: 1, max: 9, step: 1, def: 2 },
      { key: 'layers', label: 'Capas', type: 'range', min: 1, max: 4, step: 1, def: 1 },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0.1, max: 4, step: 0.05, def: 0.7 },
      { key: 'alpha', label: 'Opacidad', type: 'range', min: 0.05, max: 1, step: 0.01, def: 0.55 },
      { key: 'size', label: 'Tamaño', type: 'range', min: 0.2, max: 0.5, step: 0.01, def: 0.42 },
      { key: 'nails', label: 'Mostrar clavos', type: 'toggle', def: false },
      { key: 'colorMode', label: 'Color', type: 'select', def: 'ramp', options: [['ramp', 'Degradado'], ['single', 'Una tinta'], ['random', 'Al azar']] },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const S = Math.min(w, h) * p.size;
      const cx = w / 2, cy = h / 2;
      const phase = rng.float(0, Math.PI);
      const sides = rng.int(3, 7);
      const at = (t) => {
        const a = t * Math.PI * 2;
        switch (p.shape) {
          case 'lissajous': return [cx + Math.sin(a * p.freqA + phase) * S, cy + Math.sin(a * p.freqB) * S];
          case 'rose': { const r = Math.cos(a * p.freqA) * S * 0.9 + S * 0.1; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
          case 'polygon': {
            const seg = Math.floor(t * sides), f = t * sides - seg;
            const a0 = (seg / sides) * Math.PI * 2 - Math.PI / 2, a1 = ((seg + 1) / sides) * Math.PI * 2 - Math.PI / 2;
            return [cx + Geo.lerp(Math.cos(a0), Math.cos(a1), f) * S, cy + Geo.lerp(Math.sin(a0), Math.sin(a1), f) * S];
          }
          default: return [cx + Math.cos(a - Math.PI / 2) * S, cy + Math.sin(a - Math.PI / 2) * S];
        }
      };
      const n = p.points;
      const P = Array.from({ length: n }, (_, i) => at(i / n));
      for (let L = 0; L < p.layers; L++) {
        const k = p.mult + L * rng.float(0.5, 3);
        for (let i = 0; i < n; i++) {
          const jf = (i * k) % n;
          const j0 = Math.floor(jf), j1 = (j0 + 1) % n, fr = jf - j0;
          const tx = Geo.lerp(P[j0][0], P[j1][0], fr), ty = Geo.lerp(P[j0][1], P[j1][1], fr);
          let color = pal.colors[L % pal.colors.length];
          if (p.colorMode === 'ramp') color = Color.ramp(pal.colors, (i / n + L * 0.25) % 1);
          else if (p.colorMode === 'random') color = rng.pick(pal.colors);
          pen.line(P[i][0], P[i][1], tx, ty, { stroke: color, lw: p.lw, alpha: p.alpha });
        }
      }
      if (p.nails) for (const [x, y] of P) pen.circle(x, y, Math.max(1, p.lw * 1.6), { fill: pal.colors[0] });
    },
  });
})(window.Telar);
