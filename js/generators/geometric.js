/* Telar · generadores geométricos: Truchet, subdivisión, rejilla Bauhaus, trama, ondas */
(function (Telar) {
  'use strict';
  const { register, Color, Geo } = Telar;
  const HALF = Math.PI / 2;

  /* ───────── Teselas Truchet ───────── */
  register({
    id: 'truchet',
    name: 'Teselas Truchet',
    family: 'Geométrico',
    desc: 'Una sola pieza rotada al azar forma laberintos y caminos continuos.',
    params: [
      { key: 'cells', label: 'Celdas por lado', type: 'range', min: 3, max: 60, step: 1, def: 14 },
      { key: 'style', label: 'Pieza', type: 'select', def: 'arcs', options: [['arcs', 'Arcos'], ['diagonal', 'Diagonales'], ['triangles', 'Triángulos'], ['semis', 'Semicírculos'], ['bridges', 'Puentes'], ['mixed', 'Mezcla']] },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0.5, max: 60, step: 0.5, def: 9 },
      { key: 'filled', label: 'Rellenar', type: 'toggle', def: false },
      { key: 'colorize', label: 'Colores por celda', type: 'toggle', def: true },
      { key: 'cellBg', label: 'Fondo por celda', type: 'toggle', def: false },
      { key: 'cap', label: 'Remate', type: 'select', def: 'butt', options: [['butt', 'Recto'], ['round', 'Redondo'], ['square', 'Cuadrado']] },
      { key: 'margin', label: 'Margen', type: 'range', min: 0, max: 0.25, step: 0.01, def: 0.06 },
      { key: 'bias', label: 'Sesgo de orientación', type: 'range', min: 0, max: 1, step: 0.05, def: 0.5 },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const m = p.margin * Math.min(w, h);
      const s = (Math.min(w, h) - 2 * m) / p.cells;
      const cols = Math.floor((w - 2 * m) / s), rows = Math.floor((h - 2 * m) / s);
      const ox = (w - cols * s) / 2, oy = (h - rows * s) / 2;
      const ink = pal.colors[0];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = ox + i * s, y = oy + j * s;
        const o = rng.next() < p.bias;
        const c = p.colorize ? rng.pick(pal.colors) : ink;
        const st = { stroke: c, lw: p.lw, cap: p.cap };
        if (p.cellBg) pen.rect(x, y, s, s, { fill: Color.mix(pal.bg, rng.pick(pal.colors), 0.18) });
        let style = p.style;
        if (style === 'mixed') style = rng.pick(['arcs', 'diagonal', 'triangles', 'semis']);
        switch (style) {
          case 'arcs':
            if (p.filled) {
              if (o) { pen.arc(x, y, s / 2, 0, HALF, { fill: c, pie: true }); pen.arc(x + s, y + s, s / 2, Math.PI, Math.PI + HALF, { fill: c, pie: true }); }
              else { pen.arc(x + s, y, s / 2, HALF, Math.PI, { fill: c, pie: true }); pen.arc(x, y + s, s / 2, -HALF, 0, { fill: c, pie: true }); }
            } else if (o) { pen.arc(x, y, s / 2, 0, HALF, st); pen.arc(x + s, y + s, s / 2, Math.PI, Math.PI + HALF, st); }
            else { pen.arc(x + s, y, s / 2, HALF, Math.PI, st); pen.arc(x, y + s, s / 2, -HALF, 0, st); }
            break;
          case 'diagonal':
            if (o) pen.line(x, y, x + s, y + s, st); else pen.line(x + s, y, x, y + s, st);
            break;
          case 'triangles': {
            const k = rng.int(0, 3);
            const corners = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
            const tri = [corners[k], corners[(k + 1) % 4], corners[(k + 2) % 4]].flat();
            pen.poly(tri, { fill: c });
            break;
          }
          case 'semis': {
            const k = rng.int(0, 3);
            const mids = [[x + s / 2, y, 0], [x + s, y + s / 2, HALF], [x + s / 2, y + s, Math.PI], [x, y + s / 2, -HALF]];
            const [mx, my, a] = mids[k];
            pen.arc(mx, my, s / 2, a, a + Math.PI, p.filled ? { fill: c, pie: true } : st);
            break;
          }
          case 'bridges':
            if (o) { pen.line(x + s / 2, y, x + s / 2, y + s, st); pen.arc(x, y + s / 2, s / 2 - p.lw, -HALF, HALF, { ...st, stroke: pal.bg, lw: p.lw * 2.2 }); pen.arc(x, y + s / 2, s / 2, -HALF, HALF, st); }
            else { pen.line(x, y + s / 2, x + s, y + s / 2, st); pen.arc(x + s / 2, y, s / 2, 0, Math.PI, { ...st, stroke: pal.bg, lw: p.lw * 2.2 }); pen.arc(x + s / 2, y, s / 2, 0, Math.PI, st); }
            break;
        }
      }
    },
  });

  /* ───────── Subdivisión recursiva ───────── */
  register({
    id: 'subdivision',
    name: 'Subdivisión',
    family: 'Geométrico',
    desc: 'Un rectángulo se parte una y otra vez; cada hoja recibe color, rayas, puntos o círculos.',
    params: [
      { key: 'depth', label: 'Profundidad', type: 'range', min: 1, max: 11, step: 1, def: 6 },
      { key: 'split', label: 'Probabilidad de corte', type: 'range', min: 0.3, max: 1, step: 0.01, def: 0.82 },
      { key: 'variance', label: 'Asimetría', type: 'range', min: 0, max: 0.45, step: 0.01, def: 0.28 },
      { key: 'gap', label: 'Separación', type: 'range', min: 0, max: 30, step: 0.5, def: 6 },
      { key: 'radius', label: 'Esquinas', type: 'range', min: 0, max: 40, step: 1, def: 2 },
      { key: 'patterns', label: 'Texturas', type: 'range', min: 0, max: 1, step: 0.05, def: 0.35 },
      { key: 'empty', label: 'Huecos', type: 'range', min: 0, max: 0.8, step: 0.05, def: 0.1 },
      { key: 'outline', label: 'Contorno', type: 'toggle', def: false },
      { key: 'margin', label: 'Margen', type: 'range', min: 0, max: 0.25, step: 0.01, def: 0.06 },
      { key: 'golden', label: 'Proporción áurea', type: 'toggle', def: false },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const m = p.margin * Math.min(w, h);
      const leaves = [];
      const PHI = 0.618;
      const go = (x, y, ww, hh, d) => {
        const canSplit = d > 0 && ww > p.gap * 3 + 6 && hh > p.gap * 3 + 6;
        if (!canSplit || (d < p.depth - 1 && !rng.chance(p.split))) { leaves.push([x, y, ww, hh]); return; }
        const vertical = ww > hh ? rng.chance(0.8) : rng.chance(0.2);
        const r = p.golden ? (rng.chance(0.5) ? PHI : 1 - PHI) : 0.5 + rng.float(-p.variance, p.variance);
        if (vertical) { const a = ww * r; go(x, y, a, hh, d - 1); go(x + a, y, ww - a, hh, d - 1); }
        else { const a = hh * r; go(x, y, ww, a, d - 1); go(x, y + a, ww, hh - a, d - 1); }
      };
      go(m, m, w - 2 * m, h - 2 * m, p.depth);
      const g = p.gap / 2;
      for (const [x0, y0, w0, h0] of leaves) {
        const x = x0 + g, y = y0 + g, ww = w0 - p.gap, hh = h0 - p.gap;
        if (ww <= 0 || hh <= 0) continue;
        if (rng.chance(p.empty)) {
          if (p.outline) pen.rect(x, y, ww, hh, { stroke: pal.colors[0], lw: 1.5, r: p.radius });
          continue;
        }
        const c = rng.pick(pal.colors);
        const pattern = rng.chance(p.patterns) ? rng.pick(['stripes', 'dots', 'circle', 'half', 'grid']) : 'solid';
        const box = [x, y, x + ww, y, x + ww, y + hh, x, y + hh];
        if (pattern === 'solid') pen.rect(x, y, ww, hh, { fill: c, r: p.radius });
        else {
          const c2 = rng.pick(pal.colors.filter((k) => k !== c).concat([pal.bg]));
          pen.rect(x, y, ww, hh, { fill: c2, r: p.radius });
          pen.clipStart(box);
          if (pattern === 'stripes') {
            const step = rng.float(6, 16), ang = rng.pick([0, 45, 90, 135]) * Math.PI / 180;
            const R = Math.hypot(ww, hh), cx = x + ww / 2, cy = y + hh / 2;
            for (let t = -R; t < R; t += step) {
              const ux = Math.cos(ang), uy = Math.sin(ang);
              pen.line(cx + ux * t - uy * R, cy + uy * t + ux * R, cx + ux * t + uy * R, cy + uy * t - ux * R, { stroke: c, lw: step * 0.45, cap: 'butt' });
            }
          } else if (pattern === 'dots' || pattern === 'grid') {
            const step = rng.float(8, 18);
            for (let yy = y + step / 2; yy < y + hh; yy += step) for (let xx = x + step / 2; xx < x + ww; xx += step) {
              if (pattern === 'dots') pen.circle(xx, yy, step * 0.22, { fill: c });
              else pen.rect(xx - step * 0.2, yy - step * 0.2, step * 0.4, step * 0.4, { fill: c });
            }
          } else if (pattern === 'circle') {
            pen.circle(x + ww / 2, y + hh / 2, Math.min(ww, hh) * 0.42, { fill: c });
          } else if (pattern === 'half') {
            const k = rng.int(0, 3);
            const cx = [x, x + ww, x + ww, x][k], cy = [y, y, y + hh, y + hh][k];
            pen.circle(cx, cy, Math.min(ww, hh), { fill: c });
          }
          pen.clipEnd();
        }
        if (p.outline) pen.rect(x, y, ww, hh, { stroke: pal.colors[0], lw: 1.5, r: p.radius });
      }
    },
  });

  /* ───────── Rejilla Bauhaus ───────── */
  register({
    id: 'bauhaus',
    name: 'Rejilla Bauhaus',
    family: 'Geométrico',
    desc: 'Una cuadrícula de módulos con cuartos de círculo, medias lunas, triángulos y rayas.',
    params: [
      { key: 'cols', label: 'Columnas', type: 'range', min: 2, max: 24, step: 1, def: 6 },
      { key: 'gap', label: 'Separación', type: 'range', min: 0, max: 40, step: 1, def: 0 },
      { key: 'big', label: 'Módulos grandes', type: 'range', min: 0, max: 0.6, step: 0.05, def: 0.2 },
      { key: 'density', label: 'Densidad de figuras', type: 'range', min: 0.2, max: 1, step: 0.05, def: 0.9 },
      { key: 'motifs', label: 'Figuras', type: 'select', def: 'all', options: [['all', 'Todas'], ['curves', 'Sólo curvas'], ['straight', 'Sólo rectas'], ['circles', 'Círculos']] },
      { key: 'bgCells', label: 'Fondo por módulo', type: 'toggle', def: true },
      { key: 'margin', label: 'Margen', type: 'range', min: 0, max: 0.25, step: 0.01, def: 0.05 },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const m = p.margin * Math.min(w, h);
      const s = (w - 2 * m) / p.cols;
      const rows = Math.max(1, Math.floor((h - 2 * m) / s));
      const oy = (h - rows * s) / 2;
      const taken = new Uint8Array(p.cols * rows);
      const all = { curves: ['quarter', 'half', 'circle', 'ring', 'quarters2', 'eye'], straight: ['triangle', 'stripes', 'diamond', 'square', 'bars'], circles: ['circle', 'ring', 'dot4', 'target'] };
      const set = p.motifs === 'all' ? [...all.curves, ...all.straight, 'dot4', 'target'] : all[p.motifs];
      const cells = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < p.cols; i++) {
        if (taken[j * p.cols + i]) continue;
        let size = 1;
        if (i < p.cols - 1 && j < rows - 1 && rng.chance(p.big) && !taken[j * p.cols + i + 1] && !taken[(j + 1) * p.cols + i] && !taken[(j + 1) * p.cols + i + 1]) size = 2;
        for (let b = 0; b < size; b++) for (let a = 0; a < size; a++) taken[(j + b) * p.cols + i + a] = 1;
        cells.push([m + i * s, oy + j * s, s * size]);
      }
      for (const [x0, y0, S0] of cells) {
        const g = p.gap / 2;
        const x = x0 + g, y = y0 + g, S = S0 - p.gap;
        const bg = p.bgCells ? rng.pick([pal.bg, ...pal.colors]) : pal.bg;
        const choices = pal.colors.filter((c) => c !== bg);
        const c = rng.pick(choices.length ? choices : pal.colors);
        const c2 = rng.pick(choices.length > 1 ? choices.filter((k) => k !== c) : [pal.bg]);
        if (p.bgCells) pen.rect(x, y, S, S, { fill: bg });
        if (!rng.chance(p.density)) continue;
        const rot = rng.int(0, 3);
        const corners = [[x, y], [x + S, y], [x + S, y + S], [x, y + S]];
        const box = [x, y, x + S, y, x + S, y + S, x, y + S];
        const motif = rng.pick(set);
        pen.clipStart(box);
        switch (motif) {
          case 'quarter': { const [cx, cy] = corners[rot]; pen.circle(cx, cy, S, { fill: c }); break; }
          case 'quarters2': { const [ax, ay] = corners[rot], [bx, by] = corners[(rot + 2) % 4]; pen.circle(ax, ay, S / 2, { fill: c }); pen.circle(bx, by, S / 2, { fill: c2 }); break; }
          case 'half': { const mids = [[x + S / 2, y], [x + S, y + S / 2], [x + S / 2, y + S], [x, y + S / 2]]; const [cx, cy] = mids[rot]; pen.circle(cx, cy, S / 2, { fill: c }); break; }
          case 'circle': pen.circle(x + S / 2, y + S / 2, S * 0.42, { fill: c }); break;
          case 'ring': pen.circle(x + S / 2, y + S / 2, S * 0.36, { stroke: c, lw: S * 0.12 }); break;
          case 'target': for (let k = 4; k >= 1; k--) pen.circle(x + S / 2, y + S / 2, S * 0.12 * k, { fill: k % 2 ? c : c2 }); break;
          case 'eye': pen.circle(corners[rot][0], corners[rot][1], S, { fill: c }); pen.circle(corners[(rot + 2) % 4][0], corners[(rot + 2) % 4][1], S, { fill: c2, alpha: 0.9 }); break;
          case 'triangle': pen.poly([...corners[rot], ...corners[(rot + 1) % 4], ...corners[(rot + 2) % 4]], { fill: c }); break;
          case 'diamond': pen.poly([x + S / 2, y + S * 0.08, x + S * 0.92, y + S / 2, x + S / 2, y + S * 0.92, x + S * 0.08, y + S / 2], { fill: c }); break;
          case 'square': pen.rect(x + S * 0.2, y + S * 0.2, S * 0.6, S * 0.6, { fill: c }); break;
          case 'stripes': {
            const n = rng.int(3, 7), st = S / (n * 2);
            for (let k = 0; k < n; k++) {
              if (rot % 2) pen.rect(x + st * (2 * k + 0.5), y, st, S, { fill: c });
              else pen.rect(x, y + st * (2 * k + 0.5), S, st, { fill: c });
            }
            break;
          }
          case 'bars': pen.rect(rot % 2 ? x : x + S / 3, rot % 2 ? y + S / 3 : y, rot % 2 ? S : S / 3, rot % 2 ? S / 3 : S, { fill: c }); break;
          case 'dot4': for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) pen.circle(x + S * dx, y + S * dy, S * 0.17, { fill: rng.chance(0.5) ? c : c2 }); break;
        }
        pen.clipEnd();
      }
    },
  });

  /* ───────── Trama de semitonos ───────── */
  register({
    id: 'trama',
    name: 'Trama de semitonos',
    family: 'Geométrico',
    desc: 'Puntos que crecen y se encogen siguiendo un campo, como impresión offset ampliada.',
    params: [
      { key: 'cells', label: 'Puntos por lado', type: 'range', min: 8, max: 160, step: 1, def: 52 },
      { key: 'shape', label: 'Forma', type: 'select', def: 'circle', options: [['circle', 'Círculo'], ['square', 'Cuadrado'], ['line', 'Línea'], ['cross', 'Cruz'], ['diamond', 'Rombo']] },
      { key: 'field', label: 'Campo', type: 'select', def: 'noise', options: [['noise', 'Ruido'], ['radial', 'Radial'], ['linear', 'Lineal'], ['waves', 'Ondas'], ['rings', 'Anillos']] },
      { key: 'scale', label: 'Escala del campo', type: 'range', min: 0.3, max: 8, step: 0.1, def: 2 },
      { key: 'angle', label: 'Ángulo de trama', type: 'range', min: 0, max: 90, step: 1, def: 15 },
      { key: 'maxSize', label: 'Tamaño máximo', type: 'range', min: 0.2, max: 1.6, step: 0.02, def: 1 },
      { key: 'gamma', label: 'Contraste', type: 'range', min: 0.3, max: 3, step: 0.05, def: 1.2 },
      { key: 'layers', label: 'Capas de color', type: 'range', min: 1, max: 4, step: 1, def: 1 },
      { key: 'blend', label: 'Mezcla de capas', type: 'select', def: 'multiply', options: [['multiply', 'Multiplicar'], ['source-over', 'Normal'], ['screen', 'Trama']] },
      { key: 'invert', label: 'Invertir', type: 'toggle', def: false },
    ],
    draw({ pen, w, h, rng, noise, pal, p }) {
      pen.background(pal.bg);
      const step = Math.max(w, h) / p.cells;
      const R = Math.hypot(w, h);
      const cx = w / 2, cy = h / 2;
      const ox = rng.float(-0.2, 0.2) * w, oy = rng.float(-0.2, 0.2) * h;
      const fieldAt = (x, y, layer) => {
        const u = x / Math.max(w, h), v = y / Math.max(w, h);
        let val;
        switch (p.field) {
          case 'radial': val = 1 - Math.hypot(x - cx - ox, y - cy - oy) / (R * 0.55); break;
          case 'linear': val = (x / w) * 0.5 + (y / h) * 0.5; break;
          case 'waves': val = (Math.sin(u * p.scale * 6 + Math.sin(v * p.scale * 4 + layer)) + 1) / 2; break;
          case 'rings': val = (Math.sin(Math.hypot(x - cx - ox, y - cy - oy) / R * p.scale * 30 + layer) + 1) / 2; break;
          default: val = (noise.fbm(u * p.scale + layer * 3.1, v * p.scale + layer * 1.7, 3) + 1) / 2;
        }
        val = Geo.clamp(val, 0, 1);
        if (p.invert) val = 1 - val;
        return Math.pow(val, p.gamma);
      };
      for (let L = 0; L < p.layers; L++) {
        const color = pal.colors[L % pal.colors.length];
        const ang = ((p.angle + L * 30) * Math.PI) / 180;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const n = Math.ceil(R / step) + 2;
        const shift = L * step * 0.33;
        for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
          const gx = i * step + shift, gy = j * step + shift;
          const x = cx + gx * ca - gy * sa, y = cy + gx * sa + gy * ca;
          if (x < -step || x > w + step || y < -step || y > h + step) continue;
          const v = fieldAt(x, y, L);
          const r = (step / 2) * v * p.maxSize;
          if (r < 0.3) continue;
          const o = { fill: color, blend: p.layers > 1 ? p.blend : null };
          switch (p.shape) {
            case 'square': pen.poly(Geo.regular(x, y, r * 1.25, 4, ang + Math.PI / 4), o); break;
            case 'diamond': pen.poly(Geo.regular(x, y, r * 1.3, 4, ang), o); break;
            case 'line': pen.line(x - ca * step / 2, y - sa * step / 2, x + ca * step / 2, y + sa * step / 2, { stroke: color, lw: r * 1.3, cap: 'butt', blend: o.blend }); break;
            case 'cross': {
              const k = r * 1.2, t = r * 0.45;
              pen.line(x - ca * k, y - sa * k, x + ca * k, y + sa * k, { stroke: color, lw: t, cap: 'butt' });
              pen.line(x + sa * k, y - ca * k, x - sa * k, y + ca * k, { stroke: color, lw: t, cap: 'butt' });
              break;
            }
            default: pen.circle(x, y, r, o);
          }
        }
      }
    },
  });

  /* ───────── Ondas y moiré ───────── */
  register({
    id: 'moire',
    name: 'Ondas y moiré',
    family: 'Geométrico',
    desc: 'Anillos concéntricos desde varios centros que interfieren y producen patrones de moiré.',
    params: [
      { key: 'centers', label: 'Centros', type: 'range', min: 1, max: 5, step: 1, def: 2 },
      { key: 'rings', label: 'Anillos', type: 'range', min: 5, max: 220, step: 1, def: 80 },
      { key: 'lw', label: 'Grosor', type: 'range', min: 0.2, max: 8, step: 0.1, def: 1.6 },
      { key: 'mode', label: 'Patrón', type: 'select', def: 'rings', options: [['rings', 'Anillos'], ['spiral', 'Espiral'], ['lines', 'Líneas paralelas'], ['polygon', 'Polígonos']] },
      { key: 'sides', label: 'Lados (polígonos)', type: 'range', min: 3, max: 10, step: 1, def: 6 },
      { key: 'wobble', label: 'Ondulación', type: 'range', min: 0, max: 40, step: 0.5, def: 4 },
      { key: 'wobbleFreq', label: 'Frecuencia de ondulación', type: 'range', min: 1, max: 30, step: 1, def: 7 },
      { key: 'blend', label: 'Mezcla', type: 'select', def: 'multiply', options: [['source-over', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Trama'], ['difference', 'Diferencia']] },
      { key: 'spread', label: 'Distancia entre centros', type: 'range', min: 0, max: 0.6, step: 0.01, def: 0.12 },
    ],
    draw({ pen, w, h, rng, pal, p }) {
      pen.background(pal.bg);
      const R = Math.hypot(w, h) * 0.75;
      const S = Math.min(w, h);
      for (let c = 0; c < p.centers; c++) {
        const a = rng.float(0, Math.PI * 2);
        const d = p.centers === 1 ? 0 : S * p.spread * rng.float(0.5, 1.2);
        const cx = w / 2 + Math.cos(a) * d, cy = h / 2 + Math.sin(a) * d;
        const color = pal.colors[c % pal.colors.length];
        const o = { stroke: color, lw: p.lw, blend: p.blend };
        const phase = rng.float(0, Math.PI * 2);
        if (p.mode === 'lines') {
          const ang = rng.float(0, Math.PI);
          const ux = Math.cos(ang), uy = Math.sin(ang);
          for (let i = -p.rings; i <= p.rings; i++) {
            const t = (i / p.rings) * R;
            const pts = [];
            for (let s = -1; s <= 1.0001; s += 0.02) {
              const along = s * R;
              const wob = Math.sin(s * p.wobbleFreq * 3 + phase + i * 0.05) * p.wobble;
              pts.push(cx + ux * along - uy * (t + wob), cy + uy * along + ux * (t + wob));
            }
            pen.path(pts, o);
          }
          continue;
        }
        if (p.mode === 'spiral') {
          const pts = [];
          const turns = p.rings;
          const total = turns * 90;
          for (let s = 0; s <= total; s++) {
            const t = s / total;
            const ang = t * turns * Math.PI * 2 + phase;
            const r = t * R + Math.sin(ang * p.wobbleFreq) * p.wobble;
            pts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          }
          pen.path(pts, o);
          continue;
        }
        for (let i = 1; i <= p.rings; i++) {
          const r = (i / p.rings) * R;
          if (p.mode === 'polygon') {
            pen.poly(Geo.regular(cx, cy, r, p.sides, phase), o);
          } else if (p.wobble > 0) {
            const pts = [];
            const n = Math.max(48, Math.floor(r * 0.6));
            for (let k = 0; k < n; k++) {
              const ang = (k / n) * Math.PI * 2;
              const rr = r + Math.sin(ang * p.wobbleFreq + phase + i * 0.15) * p.wobble;
              pts.push(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
            }
            pen.poly(pts, o);
          } else pen.circle(cx, cy, r, o);
        }
      }
    },
  });
})(window.Telar);
