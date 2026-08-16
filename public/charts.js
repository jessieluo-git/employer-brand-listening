// charts.js — 手写 SVG 图表（零依赖，配色读取 CSS 语义令牌）
'use strict';
(function (global) {
  const C = () => getComputedStyle(document.documentElement);
  const v = (name) => C().getPropertyValue(name).trim();

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fmtDate(iso) { const [, m, d] = iso.split('-'); return `${+m}/${+d}`; }

  // 环形图（情感占比）
  function donut(el, data, opts = {}) {
    const size = opts.size || 150, thick = opts.thick || 20, r = (size - thick) / 2;
    const cx = size / 2, cy = size / 2;
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    let angle = -Math.PI / 2;
    const segs = data.map(d => {
      const frac = d.value / total, a2 = angle + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const seg = `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${d.color}" stroke-width="${thick}" stroke-linecap="butt"><title>${esc(d.label)}: ${d.value}</title></path>`;
      angle = a2; return seg;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" style="width:${opts.w || size}px;height:${opts.w || size}px">${segs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="24" font-weight="700" fill="${v('--m3-on-surface')}">${opts.center ?? total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="${v('--m3-on-surface-variant')}">${esc(opts.centerLabel || '')}</text></svg>`;
  }

  // 堆叠柱状 + 折线（声量趋势 & NSR）
  function stackedBars(el, series, opts = {}) {
    const W = 900, H = 220, padL = 36, padB = 24, padT = 14;
    const n = series.length, max = Math.max(...series.map(s => s.total), 1);
    const bw = Math.max(3, (W - padL - 8) / n * 0.62);
    const colors = { pos: v('--sem-pos'), neu: v('--sem-neu'), neg: v('--sem-neg') };
    let bars = '';
    series.forEach((s, i) => {
      const x = padL + (i + 0.19) * (W - padL - 8) / n;
      let y = H - padB;
      for (const k of ['pos', 'neu', 'neg']) {
        const h = (s[k] / max) * (H - padB - padT);
        if (h > 0.4) bars += `<rect x="${x}" y="${y - h}" width="${bw}" height="${h}" fill="${colors[k]}" rx="1"><title>${s.date} ${k}: ${s[k]}</title></rect>`;
        y -= h;
      }
    });
    // NSR 折线
    const pts = series.map((s, i) => [padL + (i + 0.5) * (W - padL - 8) / n, H - padB - ((s.nsr + 1) / 2) * (H - padB - padT)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const step = Math.ceil(n / 10);
    const ticks = series.filter((_, i) => i % step === 0).map((s, j) => `<text x="${padL + ((j * step) + 0.5) * (W - padL - 8) / n}" y="${H - 6}" font-size="10" fill="${v('--m3-on-surface-variant')}" text-anchor="middle">${fmtDate(s.date)}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${opts.h || 220}px">
      ${[0, .5, 1].map(f => `<line x1="${padL}" x2="${W - 4}" y1="${H - padB - f * (H - padB - padT)}" y2="${H - padB - f * (H - padB - padT)}" stroke="${v('--m3-surface-c-highest')}" stroke-width="1"/>`).join('')}
      ${bars}
      <path d="${line}" fill="none" stroke="${v('--m3-primary')}" stroke-width="2" stroke-linejoin="round"/>
      ${pts.filter((_, i) => i % step === 0).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${v('--m3-primary')}"/>`).join('')}
      ${ticks}</svg>`;
  }

  // 雷达图（六方面 我 vs 竞品）
  function radar(el, axes, seriesList, opts = {}) {
    const size = 320, cx = size / 2, cy = size / 2 + 6, R = size / 2 - 46;
    const n = axes.length;
    const pt = (i, val) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n, r = R * (val / 100);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const rings = [25, 50, 75, 100].map(r => `<polygon points="${axes.map((_, i) => pt(i, r).join(',')).join(' ')}" fill="none" stroke="${v('--m3-surface-c-highest')}" stroke-width="1"/>`).join('');
    const spokes = axes.map((_, i) => { const [x, y] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${v('--m3-surface-c-highest')}"/>`; }).join('');
    const labels = axes.map((ax, i) => {
      const [x, y] = pt(i, 122);
      return `<text x="${x}" y="${y + 4}" font-size="12" fill="${v('--m3-on-surface')}" text-anchor="middle" font-weight="600">${esc(ax)}</text>`;
    }).join('');
    const polys = seriesList.map((s, si) => {
      const pts = s.values.map((val, i) => pt(i, val).join(',')).join(' ');
      return `<polygon points="${pts}" fill="${s.color}" fill-opacity="0.18" stroke="${s.color}" stroke-width="2" stroke-linejoin="round">
        ${s.values.map((val, i) => { const [x, y] = pt(i, val); return `<circle cx="${x}" cy="${y}" r="3.5" fill="${s.color}"><title>${esc(axes[i])}: ${val}</title></circle>`; }).join('')}
      </polygon>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" style="width:${opts.w || 320}px;max-width:100%;height:auto">${rings}${spokes}${polys}${labels}</svg>`;
  }

  // 水平条形图（竞品 EBHI / 话题榜）
  function hbars(el, items, opts = {}) {
    const W = 520, rowH = opts.rowH || 30, H = items.length * rowH + 8;
    const max = Math.max(...items.map(i => Math.abs(i.value)), 100);
    const rows = items.map((it, i) => {
      const y = i * rowH + 4, bw = (Math.abs(it.value) / max) * (W - 150);
      const color = it.color || (it.value >= 70 ? v('--sem-pos') : it.value >= 50 ? v('--sem-warn') : v('--sem-neg'));
      return `<text x="0" y="${y + 13}" font-size="12" fill="${v('--m3-on-surface')}" font-weight="600">${esc(it.label)}</text>
        <rect x="86" y="${y}" width="${Math.max(bw, 2)}" height="${rowH - 10}" rx="4" fill="${color}"><title>${esc(it.label)}: ${it.value}</title></rect>
        <text x="${90 + Math.max(bw, 2)}" y="${y + 13}" font-size="12" fill="${v('--m3-on-surface-variant')}" font-weight="600">${it.value}${it.suffix || ''}</text>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;min-height:${H}px">${rows}</svg>`;
  }

  // 热力图（方面 × 竞品横评）
  function heatmap(el, rows, cols, matrix, opts = {}) {
    const cw = 92, chh = 42, hl = 118;
    const cell = (val) => {
      // 0 红 → 50 黄 → 100 绿（PRD 语义色）
      let bg;
      if (val >= 50) bg = `color-mix(in srgb, ${v('--sem-pos')} ${Math.round((val - 50) * 2)}%, ${v('--sem-warn-c')})`;
      else bg = `color-mix(in srgb, ${v('--sem-neg')} ${Math.round((50 - val) * 2)}%, ${v('--sem-warn-c')})`;
      return bg;
    };
    let out = `<text x="0" y="14" font-size="12" font-weight="700" fill="${v('--m3-on-surface-variant')}"></text>`;
    cols.forEach((c, j) => { out += `<text x="${hl + j * cw + cw / 2}" y="14" font-size="12" font-weight="600" fill="${v('--m3-on-surface-variant')}" text-anchor="middle">${esc(c)}</text>`; });
    rows.forEach((r, i) => {
      out += `<text x="0" y="${34 + i * chh + 26}" font-size="12" font-weight="600" fill="${v('--m3-on-surface')}">${esc(r)}</text>`;
      cols.forEach((_, j) => {
        const val = matrix[i][j];
        out += `<rect x="${hl + j * cw + 3}" y="${26 + i * chh}" width="${cw - 6}" height="${chh - 6}" rx="8" fill="${cell(val)}"><title>${esc(r)} × ${esc(cols[j])}: ${val}</title></rect>
          <text x="${hl + j * cw + cw / 2}" y="${26 + i * chh + 25}" font-size="13" font-weight="700" fill="${v('--m3-on-surface')}" text-anchor="middle">${val}</text>`;
      });
    });
    el.innerHTML = `<svg viewBox="0 0 ${hl + cols.length * cw} ${30 + rows.length * chh}" style="width:100%;height:auto">${out}</svg>`;
  }

  // 折线（周度方面趋势 / offer 热度）
  function line(el, seriesList, opts = {}) {
    const W = 480, H = 160, padL = 30, padB = 20, padT = 10;
    const all = seriesList.flatMap(s => s.values.filter(x => x != null));
    const min = opts.min ?? Math.min(...all, 0) - 2, max = opts.max ?? Math.max(...all) + 2;
    const X = (i, n) => padL + (i / Math.max(n - 1, 1)) * (W - padL - 8);
    const Y = (val) => H - padB - ((val - min) / (max - min || 1)) * (H - padB - padT);
    let out = '';
    seriesList.forEach(s => {
      const pts = s.values.map((val, i) => val == null ? null : [X(i, s.values.length), Y(val)]).filter(Boolean);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="${s.dash || ''}"/>`;
      out += pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${s.color}"/>`).join('');
    });
    const labels = (opts.labels || []).map((t, i, arr) => `<text x="${X(i, arr.length)}" y="${H - 5}" font-size="10" fill="${v('--m3-on-surface-variant')}" text-anchor="middle">${esc(t)}</text>`).join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${opts.h || 160}px">
      <line x1="${padL}" x2="${W - 4}" y1="${Y(opts.refLine ?? 50)}" y2="${Y(opts.refLine ?? 50)}" stroke="${v('--m3-outline-variant')}" stroke-dasharray="4 4"/>
      ${out}${labels}</svg>`;
  }

  // 星级分布
  function stars(el, data) {
    const W = 420, rowH = 26, max = Math.max(...data.map(d => d.count));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${data.length * rowH}" style="width:100%;height:auto">` + data.map((d, i) => {
      const bw = (d.count / max) * 240;
      const color = d.stars >= 4 ? v('--sem-pos') : d.stars === 3 ? v('--sem-warn') : v('--sem-neg');
      return `<text x="0" y="${i * rowH + 17}" font-size="12" fill="${v('--m3-on-surface')}" font-weight="600">${'★'.repeat(d.stars)}${'☆'.repeat(5 - d.stars)}</text>
        <rect x="110" y="${i * rowH + 5}" width="${bw}" height="14" rx="7" fill="${color}"/>
        <text x="${118 + bw}" y="${i * rowH + 17}" font-size="11" fill="${v('--m3-on-surface-variant')}">${d.count}</text>`;
    }).join('') + '</svg>';
  }

  global.Charts = { donut, stackedBars, radar, hbars, heatmap, line, stars, cssVar: v };
})(window);
