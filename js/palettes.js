/* Telar · paletas curadas y generador de armonías */
(function (Telar) {
  'use strict';
  const { Color } = Telar;

  // bg = fondo, colors = tintas. Las primeras están inspiradas en Oaxaca y México.
  const PALETTES = [
    { name: 'Mercado de Abastos', tag: 'Oaxaca', bg: '#f3ead8', colors: ['#d1462f', '#f2a541', '#2a7f62', '#1f3b70', '#e86a92'] },
    { name: 'Barro negro', tag: 'Oaxaca', bg: '#16130f', colors: ['#3a332b', '#8c7b65', '#d9c6a5', '#b0472e', '#f1e9dc'] },
    { name: 'Grana cochinilla', tag: 'Oaxaca', bg: '#f6efe7', colors: ['#7a0f24', '#b3203a', '#e05d5d', '#f2b5a7', '#2d1b1e'] },
    { name: 'Alebrije', tag: 'Oaxaca', bg: '#101826', colors: ['#ff5d8f', '#ffd23f', '#3bceac', '#0ead69', '#7b5cff', '#ff8c42'] },
    { name: 'Mezcal y agave', tag: 'Oaxaca', bg: '#e8e4d4', colors: ['#3e5c4f', '#7fa37c', '#c9b98b', '#a2603a', '#24302b'] },
    { name: 'Jacaranda', tag: 'México', bg: '#f4f1f7', colors: ['#6c4ab6', '#8d72e1', '#b9a2ff', '#3d2c6b', '#f2a7c3'] },
    { name: 'Talavera', tag: 'México', bg: '#f7f5ef', colors: ['#1c3f94', '#2f6fd0', '#f2b134', '#1a2445', '#6ea4e8'] },
    { name: 'Papel picado', tag: 'México', bg: '#fffaf0', colors: ['#ff4f79', '#ffb30f', '#2ec4b6', '#7b2cbf', '#ff8b3d', '#3a86ff'] },
    { name: 'Cempasúchil', tag: 'México', bg: '#2a1a1f', colors: ['#ff9f1c', '#ffbf69', '#e85d04', '#9d0208', '#f4e3c1'] },
    { name: 'Monte Albán', tag: 'Oaxaca', bg: '#d8cfbf', colors: ['#5f574a', '#8f8372', '#b9ad98', '#3c372f', '#9a6b4f'] },
    { name: 'Tule', tag: 'Oaxaca', bg: '#ecf0e6', colors: ['#1f4d3a', '#43815c', '#9cc495', '#5b4636', '#d6b77b'] },
    { name: 'Hierve el Agua', tag: 'Oaxaca', bg: '#eef5f4', colors: ['#2e8b8b', '#7cc6c0', '#d7c9a7', '#9a8c73', '#24515a'] },
    { name: 'Bauhaus', tag: 'Clásica', bg: '#efe8dc', colors: ['#d62828', '#1d3557', '#f4a300', '#111111'] },
    { name: 'Tinta y papel', tag: 'Mono', bg: '#f5f2ea', colors: ['#141414', '#3b3b3b', '#7a7a7a'] },
    { name: 'Noche tinta', tag: 'Mono', bg: '#0e0e10', colors: ['#f2efe8', '#a7a3a0', '#5e5b58'] },
    { name: 'Risografía', tag: 'Impresión', bg: '#f7f3eb', colors: ['#ff48b0', '#0078bf', '#ffe800', '#00a95c'] },
    { name: 'Cianotipo', tag: 'Impresión', bg: '#123a6b', colors: ['#e9f1fb', '#9cc3ea', '#5d8fc8', '#ffffff'] },
    { name: 'Sepia', tag: 'Impresión', bg: '#efe2c8', colors: ['#5b3a1e', '#8e6136', '#c19a6b', '#2e1d10'] },
    { name: 'Bosque nuboso', tag: 'Naturaleza', bg: '#dde5df', colors: ['#14342b', '#2f5d50', '#6c9a8b', '#a3c4bc', '#e8d6a8'] },
    { name: 'Arrecife', tag: 'Naturaleza', bg: '#03213a', colors: ['#00b4d8', '#90e0ef', '#ff7f51', '#ffd166', '#06d6a0'] },
    { name: 'Desierto', tag: 'Naturaleza', bg: '#f1e3cf', colors: ['#c06c3e', '#e0a26c', '#8a4b2d', '#3f6e6d', '#f6d6a8'] },
    { name: 'Aurora', tag: 'Naturaleza', bg: '#070b1a', colors: ['#2de2a6', '#3a86ff', '#8338ec', '#ff006e', '#c9f2ff'] },
    { name: 'Lavanda', tag: 'Suave', bg: '#f6f3fb', colors: ['#bfa6e0', '#9381ff', '#ffd8be', '#b8b8ff', '#5e548e'] },
    { name: 'Durazno', tag: 'Suave', bg: '#fff3ea', colors: ['#ffb4a2', '#e5989b', '#b5838d', '#6d6875', '#ffcdb2'] },
    { name: 'Menta', tag: 'Suave', bg: '#f0f7f4', colors: ['#70c1b3', '#b2dbbf', '#247ba0', '#f3ffbd', '#ff1654'] },
    { name: 'Neón', tag: 'Vibrante', bg: '#0b0b12', colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0'] },
    { name: 'Pop', tag: 'Vibrante', bg: '#fdf6e3', colors: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c'] },
    { name: 'Terminal', tag: 'Vibrante', bg: '#0d1310', colors: ['#3cff8f', '#1fa463', '#c6ffd8', '#0f5132'] },
    { name: 'Óxido', tag: 'Tierra', bg: '#1b1714', colors: ['#c2532f', '#e38b4f', '#6f2e1e', '#d9b38c', '#3e5641'] },
    { name: 'Arcilla', tag: 'Tierra', bg: '#ede0d4', colors: ['#9c6644', '#b08968', '#7f5539', '#ddb892', '#4a3427'] },
    { name: 'Índigo', tag: 'Tierra', bg: '#e9ecf2', colors: ['#14213d', '#283c6b', '#4a6fa5', '#c9a227', '#e5e5e5'] },
    { name: 'Vitral', tag: 'Vibrante', bg: '#161616', colors: ['#e63946', '#f1c453', '#2a9d8f', '#457b9d', '#e9c46a', '#9b5de5'] },
  ];

  /* Genera una paleta armónica a partir de un tono base usando reglas clásicas. */
  const HARMONIES = {
    'análoga': (h) => [h - 30, h - 15, h, h + 15, h + 30],
    complementaria: (h) => [h, h + 10, h + 180, h + 170, h + 190],
    'triádica': (h) => [h, h + 120, h + 240, h + 20, h + 140],
    'tetrádica': (h) => [h, h + 90, h + 180, h + 270],
    'complementaria dividida': (h) => [h, h + 150, h + 210, h + 10],
    'monocromática': (h) => [h, h, h, h, h],
  };

  function generateHarmony(rng, mode) {
    const keys = Object.keys(HARMONIES);
    const m = mode && HARMONIES[mode] ? mode : rng.pick(keys);
    const base = rng.float(0, 360);
    const hues = HARMONIES[m](base);
    const sat = rng.float(0.45, 0.85);
    const dark = rng.chance(0.4);
    const colors = hues.map((h, i) => {
      const l = m === 'monocromática' ? 0.2 + (i / hues.length) * 0.6 : rng.float(0.35, 0.7);
      return Color.hslToHex(h + rng.float(-6, 6), sat + rng.float(-0.15, 0.1), l);
    });
    const bg = dark ? Color.hslToHex(base + 20, 0.25, rng.float(0.05, 0.11)) : Color.hslToHex(base + 30, 0.3, rng.float(0.92, 0.97));
    return { name: `Armonía ${m}`, tag: 'Generada', bg, colors };
  }

  /* Extrae una paleta de una imagen con k-means simple sobre píxeles muestreados. */
  function paletteFromImage(img, k = 5) {
    const c = document.createElement('canvas');
    const s = 80;
    const ratio = img.width / img.height;
    c.width = ratio >= 1 ? s : Math.round(s * ratio);
    c.height = ratio >= 1 ? Math.round(s / ratio) : s;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const px = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
    if (!px.length) return null;
    const rng = Telar.makeRng(42);
    let cent = Array.from({ length: k + 1 }, () => px[Math.floor(rng.next() * px.length)].slice());
    for (let it = 0; it < 12; it++) {
      const sums = cent.map(() => [0, 0, 0, 0]);
      for (const p of px) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < cent.length; j++) {
          const dd = (p[0] - cent[j][0]) ** 2 + (p[1] - cent[j][1]) ** 2 + (p[2] - cent[j][2]) ** 2;
          if (dd < bd) { bd = dd; best = j; }
        }
        const sm = sums[best]; sm[0] += p[0]; sm[1] += p[1]; sm[2] += p[2]; sm[3]++;
      }
      cent = cent.map((c0, j) => (sums[j][3] ? [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3], sums[j][3]] : c0));
    }
    cent.sort((a, b) => (b[3] || 0) - (a[3] || 0));
    const hexes = cent.map((c0) => Color.rgbToHex(c0[0], c0[1], c0[2]));
    // El más abundante y menos saturado funciona como fondo
    let bgIdx = 0, bestScore = -Infinity;
    hexes.forEach((h, i) => {
      const [, s] = Color.rgbToHsl(...Color.hexToRgb(h));
      const score = (cent[i][3] || 0) / px.length - s * 0.6;
      if (score > bestScore) { bestScore = score; bgIdx = i; }
    });
    const bg = hexes[bgIdx];
    return { name: 'Desde imagen', tag: 'Imagen', bg, colors: hexes.filter((_, i) => i !== bgIdx) };
  }

  Telar.PALETTES = PALETTES;
  Telar.HARMONIES = Object.keys(HARMONIES);
  Telar.generateHarmony = generateHarmony;
  Telar.paletteFromImage = paletteFromImage;
})(window.Telar);
