// app.js — 雇主品牌社交媒体倾听平台 SPA（Material 3）
'use strict';
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const api = {
  get: (u) => fetch(u).then(r => r.json()),
  send: (u, method, body) => fetch(u, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json()),
};
const ASPECT_NAMES = { pay: '薪酬福利', mgmt: '管理与文化', workload: '工作强度与平衡', growth: '职业发展', env: '办公环境', org: '组织变动' };
const POL_NAMES = { pos: '正面', neu: '中性', neg: '负面' };
const state = { days: 30, page: 'overview', company: null, evidence: [], theme: localStorage.getItem('eb-theme') || 'light' };

function snackbar(msg) {
  const el = document.createElement('div');
  el.className = 'm3-snackbar'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function fmtTime(ts) {
  const d = new Date(ts), now = Date.now(), diff = (now - ts) / 3600000;
  if (diff < 1) return `${Math.max(1, Math.round(diff * 60))} 分钟前`;
  if (diff < 24) return `${Math.round(diff)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDue(ts) { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; }
function ebhiColor(v) { return v >= 70 ? 'var(--sem-pos)' : v >= 50 ? 'var(--sem-warn)' : 'var(--sem-neg)'; }
function deltaHTML(d, invert = false) {
  const good = invert ? d < 0 : d > 0;
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '—';
  return `<span style="color:${d === 0 ? 'var(--m3-on-surface-variant)' : good ? 'var(--sem-pos)' : 'var(--sem-neg)'};font-weight:700;font-size:13px">${arrow} ${Math.abs(d)}</span>`;
}

// ---------- 图标（Material Symbols 风格 SVG 路径） ----------
const ICONS = {
  overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  aspects: 'M12 2 6 7v3h12V7l-6-5zm-7 9H2v11h3V11zm17 0h-3v11h3V11zM8 11h8v11H8V11z',
  competitors: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  candidate: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  alerts: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  mentions: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z',
  actions: 'M3 5h2v14H3V5zm18 0h2v14h-2V5zM11 4h2v16h-2V4zM7 7h2v10H7V7zm8 0h2v10h-2V7zM17 9h2v6h-2V9zM13 9h.01M5 9h2v6H5V9z',
  reports: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
};
const icon = (name) => `<svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="${ICONS[name]}"/></svg>`;

// ---------- 导航与路由 ----------
const NAV = [
  { key: 'overview', label: '综合概览' }, { key: 'aspects', label: '方面口碑' },
  { key: 'competitors', label: '竞品对标' }, { key: 'candidate', label: '候选人视角' },
  { key: 'alerts', label: '预警中心' }, { key: 'mentions', label: '原声明细' },
  { key: 'actions', label: '行动看板' }, { key: 'reports', label: '分析报告' },
  { key: 'settings', label: '配置中心' },
];
const PAGE_TITLES = {
  overview: '综合概览', aspects: '方面口碑', competitors: '竞品对标', candidate: '候选人视角',
  alerts: '预警中心', mentions: '原声明明', actions: '行动看板', reports: '分析报告', settings: '配置中心',
};

function renderNav(alertCount) {
  const nav = $('#navRail');
  nav.innerHTML = `<div class="brand-mark">EB</div>` + NAV.map(n => `
    <button class="nav-item ${state.page === n.key ? 'active' : ''}" data-page="${n.key}">
      ${icon(n.key)}<span>${n.label}</span>
      ${n.key === 'alerts' && alertCount ? `<span class="nav-badge">${alertCount}</span>` : ''}
      ${n.key === 'mentions' && state.evidence.length ? `<span class="nav-badge" style="background:var(--m3-tertiary)">${state.evidence.length}</span>` : ''}
    </button>`).join('') + `<div class="spacer"></div>
    <button class="nav-item" id="themeBtn" title="切换明暗主题">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="${state.theme === 'light' ? 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z' : 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5l2.39 3.42h-4.78L12 2zm0 20l-2.39-3.42h4.78L12 22zM2 12l3.42-2.39v4.78L2 12zm20 0l-3.42 2.39V9.61L22 12zM4.93 4.93l4.02.76-2.85 2.85-.76-4.02zm14.14 14.14-4.02-.76 2.85-2.85.76 4.02zM19.07 4.93l-.76 4.02-2.85-2.85 3.61-1.17zM4.93 19.07l.76-4.02 2.85 2.85-3.61 1.17z'}"/></svg>
      <span>主题</span></button>`;
  $$('#navRail .nav-item[data-page]').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.page; });
  $('#themeBtn').onclick = () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem('eb-theme', state.theme);
    route();
  };
}

async function route() {
  const key = (location.hash.replace('#/', '') || 'overview').split('?')[0];
  state.page = NAV.some(n => n.key === key) ? key : 'overview';
  document.documentElement.dataset.theme = state.theme;
  const alerts = await api.get('/api/alerts');
  renderNav(alerts.filter(a => a.status === 'active').length);
  $('#barTitle').textContent = PAGE_TITLES[state.page] || '';
  $('#barSub').textContent = state.company ? `${state.company.name} · 监测 ${state.days} 天窗口` : '';
  const c = $('#content'); c.innerHTML = '';
  ({ overview: pgOverview, aspects: pgAspects, competitors: pgCompetitors, candidate: pgCandidate,
     alerts: pgAlerts, mentions: pgMentions, actions: pgActions, reports: pgReports, settings: pgSettings }[state.page] || pgOverview)(c);
  c.scrollTop = 0; $('#content').scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------- 全局筛选（时间窗） ----------
function timeFilterHTML() {
  return `<div class="m3-seg">${[7, 30, 90].map(d => `<button data-days="${d}" class="${state.days === d ? 'selected' : ''}">${d} 天</button>`).join('')}</div>`;
}
function bindTimeFilter(root, rerender) {
  $$('[data-days]', root).forEach(b => b.onclick = () => { state.days = +b.dataset.days; rerender(); });
}

// ---------- 洞察行（结论先行） ----------
const insight = (text) => `<div class="insight-line"><span class="tag">AI 洞察</span><span>${text}</span></div>`;

/* ================= 综合概览 ================= */
async function pgOverview(root) {
  root.innerHTML = `<div class="empty">加载中…</div>`;
  const d = await api.get(`/api/dashboard/overview?days=${state.days}`);
  const cmps = [{ label: d.ebhi && state.company.shortName || '本企业', value: d.ebhi.total }].concat(d.competitors.map(c => ({ label: c.name, value: c.ebhi })));
  const topTopics = d.topics.slice(0, 7).map(t => ({ label: t.topic, value: t.count, suffix: ' 条', color: t.negRate > .5 ? 'var(--sem-neg)' : t.negRate > .35 ? 'var(--sem-warn)' : 'var(--sem-pos)' }));
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">
    <div class="row">${timeFilterHTML()}
      <span class="m3-chip"><span class="dot" style="background:var(--sem-pos)"></span>正面 ${d.volume.pos}</span>
      <span class="m3-chip"><span class="dot" style="background:var(--sem-neu)"></span>中性 ${d.volume.neu}</span>
      <span class="m3-chip"><span class="dot" style="background:var(--sem-neg)"></span>负面 ${d.volume.neg}</span>
    </div>
    <button class="m3-btn tonal sm" id="btnQuickReport">⚡ 生成本期报告</button>
  </div>
  <div class="grid cols-4">
    <div class="m3-card elevated"><div class="card-title"><span class="t">雇主品牌健康度 EBHI</span></div>
      <div class="m3-display-s m3-num" style="color:${ebhiColor(d.ebhi.total)}">${d.ebhi.total}</div>
      <div class="row mt8"><span class="tiny">环比</span>${deltaHTML(d.ebhi.delta)}<span class="tiny">上期 ${d.ebhi.prev}</span></div>
      <div class="tiny mt8">平台覆盖修正 ×${d.ebhi.corrections.platformCoverage} · 影响力修正 ×${d.ebhi.corrections.influenceAdj}</div>
      ${insight(`健康度环比${d.ebhi.delta >= 0 ? '回升' : '下滑'}，主要拖累方面：<b>${[...d.aspectTrend].sort((a, b) => a.delta - b.delta)[0].name}</b>`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">情感占比</span></div>
      <div class="row" style="gap:18px"><div id="ovDonut"></div>
      <div class="m3-body-s">${['pos', 'neu', 'neg'].map((k, i) => `<div class="row" style="gap:6px;margin-bottom:6px"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:${['var(--sem-pos)', 'var(--sem-neu)', 'var(--sem-neg)'][i]}"></span>${POL_NAMES[k]} <b class="m3-num">${d.volume[k]}</b> <span class="tiny">${Math.round(d.volume[k] / d.volume.total * 100)}%</span></div>`).join('')}
        <div class="tiny" style="margin-top:6px">NSR 净情感比 <b class="m3-num">${d.volume.nsr}</b></div></div></div>
      ${insight(`负面占比 <b>${Math.round(d.volume.neg / d.volume.total * 100)}%</b>，${d.volume.nsr < 0 ? '净情感比为负，口碑处于防守区间' : '净情感比为正，整体口碑健康'}`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">声量份额 SOV</span></div>
      <div class="m3-display-s m3-num">${Math.round(d.sov * 100)}<span style="font-size:20px">%</span></div>
      <div class="tiny mt8">本企业声量 /（本企业+竞品合计）</div>
      <div class="row mt8"><span class="badge blue">中国 ${d.region.cn} 条</span><span class="badge neu">海外 ${d.region.global} 条</span></div>
      <div class="tiny mt8">中国负面率 ${Math.round(d.region.cnNegRate * 100)}% · 海外负面率 ${Math.round(d.region.globalNegRate * 100)}%</div>
      ${insight(`中国区为声量主阵地（占 ${Math.round(d.region.cn / d.volume.total * 100)}%），${d.region.cnNegRate > d.region.globalNegRate ? '中国区负面率高于海外，需重点处置' : '海外负面率更高，注意 Glassdoor 评分维护'}`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">方面得分与环比</span></div>
      ${d.aspectTrend.map(a => `<div class="row between" style="padding:3px 0"><span class="m3-body-s">${a.name}</span><span class="row" style="gap:6px"><b class="m3-num m3-body-s" style="color:${ebhiColor(a.score)}">${a.score}</b>${deltaHTML(a.delta)}</span></div>`).join('')}
    </div>
  </div>
  <div class="grid cols-2 mt16">
    <div class="m3-card elevated"><div class="card-title"><span class="t">声量与情感趋势</span><span class="tiny">柱：声量（正/中/负）· 线：NSR</span></div>
      <div id="ovTrend"></div>
      ${insight(d.series.length > 7 && d.series.slice(-7).reduce((a, b) => a + b.neg, 0) > d.series.slice(-14, -7).reduce((a, b) => a + b.neg, 0) ? `近 7 天负面声量显著高于前一周，与「${(d.topics[0] || {}).topic || '热点'}」话题发酵相关` : '声量与情感走势平稳，无异常突增')}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">竞品健康度对比</span></div>
      <div id="ovCmp"></div>
      ${insight(`我方 EBHI ${d.ebhi.total} 分，${d.ebhi.total >= d.competitors[0].ebhi ? '领先' : '落后'}竞品榜首 ${d.competitors[0].name}（${d.competitors[0].ebhi}）${Math.abs(d.ebhi.total - d.competitors[0].ebhi)} 分`)}
    </div>
  </div>
  <div class="grid cols-2 mt16">
    <div class="m3-card elevated"><div class="card-title"><span class="t">热点话题 Top7</span><span class="tiny">颜色=负面率水位</span></div>
      <div id="ovTopics"></div>
      ${insight(`声量第一话题「${d.topics[0].topic}」负面率 ${Math.round(d.topics[0].negRate * 100)}%，${d.topics[0].negRate > .4 ? '建议进入预警中心处置' : '处于可控区间'}`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">平台声量分布</span></div>
      <div class="m3-table-wrap"><table class="m3-table"><thead><tr><th>平台</th><th>区域</th><th>声量</th><th>负面率</th></tr></thead>
      <tbody>${d.byPlatform.slice(0, 8).map(p => `<tr><td><b>${p.name}</b></td><td>${p.region === 'cn' ? '中国' : '海外'}</td><td class="m3-num">${p.count}</td><td><span class="badge ${p.negRate > .45 ? 'neg' : p.negRate > .3 ? 'yellow' : 'pos'}">${Math.round(p.negRate * 100)}%</span></td></tr>`).join('')}</tbody></table></div>
      ${insight('脉脉/小红书为负面主要来源平台，优先在这两个平台做官方回应与内容投放')}
    </div>
  </div>`;
  bindTimeFilter(root, route);
  $('#btnQuickReport').onclick = async () => {
    snackbar('正在生成报告（LLM 分析中）…');
    const r = await api.send('/api/reports/generate', 'POST', { days: state.days, type: '定制报告' });
    snackbar(`《${r.type}》已生成，前往“分析报告”查看`);
    setTimeout(() => location.hash = '#/reports', 800);
  };
  const css = () => getComputedStyle(document.documentElement).getPropertyValue.bind(getComputedStyle(document.documentElement));
  Charts.donut($('#ovDonut'), [
    { label: '正面', value: d.volume.pos, color: Charts.cssVar('--sem-pos') },
    { label: '中性', value: d.volume.neu, color: Charts.cssVar('--sem-neu') },
    { label: '负面', value: d.volume.neg, color: Charts.cssVar('--sem-neg') },
  ], { size: 140, w: 130, center: Math.round(d.volume.pos / d.volume.total * 100) + '%', centerLabel: '正面占比' });
  Charts.stackedBars($('#ovTrend'), d.series);
  Charts.hbars($('#ovCmp'), cmps);
  Charts.hbars($('#ovTopics'), topTopics);
}

/* ================= 方面口碑 ================= */
async function pgAspects(root) {
  root.innerHTML = `<div class="empty">加载中…</div>`;
  const d = await api.get(`/api/dashboard/aspects?days=${state.days}`);
  const self = d.self.map(a => a.score);
  const comp = d.detail.map(a => a.compAvg);
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">${timeFilterHTML()}
    <span class="tiny">点击雷达顶点对应下方卡片可下钻详情</span></div>
  <div class="m3-card elevated"><div class="card-title"><span class="t">六方面情感雷达（我方 vs 竞品均值）</span>
    <div class="row"><span class="badge blue">我方</span><span class="badge neu">竞品均值</span></div></div>
    <div class="row" style="justify-content:center"><div id="asRadar"></div></div>
    ${insight(`最大短板：<b>${[...d.detail].sort((a, b) => a.deltaVsComp - b.deltaVsComp)[0].name}</b>（低于竞品均值 ${Math.abs([...d.detail].sort((a, b) => a.deltaVsComp - b.deltaVsComp)[0].deltaVsComp)} 分）；最大优势：<b>${[...d.detail].sort((a, b) => b.deltaVsComp - a.deltaVsComp)[0].name}</b>`)}
  </div>
  <div class="grid cols-3 mt16">
  ${d.detail.map(a => `
    <div class="m3-card elevated" data-aspect="${a.key}">
      <div class="card-title"><span class="t">${a.name}</span>
        <span class="badge ${a.deltaVsComp >= 0 ? 'pos' : 'neg'}">vs 竞品 ${a.deltaVsComp >= 0 ? '+' : ''}${a.deltaVsComp}</span></div>
      <div class="row" style="gap:12px;align-items:baseline">
        <span class="m3-headline-s m3-num" style="color:${ebhiColor(a.score)}">${a.score}</span>
        <span class="tiny">竞品均值 ${a.compAvg} · 命中 ${a.total} 条（正 ${a.pos} / 负 ${a.neg}）</span></div>
      <div class="mt8" id="asLine-${a.key}"></div>
      <div class="wordcloud mt8">${a.keywords.slice(0, 8).map((k, i) => `<span style="font-size:${11 + Math.min(k.w, 14)}px;color:${i < 2 ? 'var(--sem-neg)' : 'var(--m3-on-surface-variant)'};font-weight:${i < 2 ? 700 : 400}">${k.text}</span>`).join('')}</div>
      <details class="mt8"><summary class="m3-label-m" style="cursor:pointer;color:var(--m3-primary)">查看典型原声（员工/候选人/媒体分轨）</summary>
        ${['员工', '候选人', '媒体'].map(aud => a.voices[aud] && a.voices[aud].length ? `<div class="tiny mt8" style="font-weight:700;color:var(--m3-on-surface-variant)">${aud}口吻</div>` + a.voices[aud].map(m => `<div class="quote-card neg" style="margin-top:6px"><div class="q-text">${m.text}</div><div class="q-meta"><span class="badge neg">${POL_NAMES[m.sentiment.polarity]}</span><span>${platName(m.platform)}</span><span>影响力 ${m.influence}</span><span>${fmtTime(m.time)}</span></div></div>`).join('') : '').join('')}
      </details>
      <div class="row mt8"><button class="m3-btn tonal sm" data-drill="${a.key}">下钻原声</button>
        <button class="m3-btn text sm" data-strategy="${a.key}" data-name="${a.name}">生成对策</button></div>
    </div>`).join('')}
  </div>`;
  bindTimeFilter(root, route);
  Charts.radar($('#asRadar'), d.self.map(a => a.name), [
    { name: '我方', values: self, color: Charts.cssVar('--m3-primary') },
    { name: '竞品均值', values: comp, color: Charts.cssVar('--sem-neu'), dash: '5 4' },
  ], { w: 380 });
  $$('[data-drill]', root).forEach(b => b.onclick = () => { location.hash = '#/mentions'; sessionStorage.setItem('eb-filter-aspect', b.dataset.drill); });
  $$('[data-strategy]', root).forEach(b => b.onclick = () => openStrategyDialog({ aspect: b.dataset.strategy, topic: b.dataset.name }));
  d.detail.forEach(a => Charts.line($(`#asLine-${a.key}`), [
    { name: '我方周度', values: a.weekly.map(w => w.score), color: Charts.cssVar('--m3-primary') },
    { name: '竞品', values: a.weekly.map(() => a.compAvg), color: Charts.cssVar('--sem-neu'), dash: '4 4' },
  ], { labels: a.weekly.map(w => w.week), h: 110, min: 0, max: 100 }));
}
const platName = (key) => ({ maimai: '脉脉', kanzhun: '看准网', boss: 'BOSS直聘', zhihu: '知乎', weibo: '微博', xhs: '小红书', bili: 'B站', tieba: '贴吧', douban: '豆瓣小组', glassdoor: 'Glassdoor', indeed: 'Indeed', blind: 'Blind', reddit: 'Reddit', twitter: 'X/Twitter', linkedin: 'LinkedIn', news: '新闻/博客' }[key] || key);

/* ================= 竞品对标 ================= */
async function pgCompetitors(root) {
  root.innerHTML = `<div class="empty">加载中…</div>`;
  const [ov, asp] = await Promise.all([api.get(`/api/dashboard/overview?days=${state.days}`), api.get(`/api/dashboard/aspects?days=${state.days}`)]);
  const cols = ['我方', ...ov.competitors.map(c => c.name)];
  const matrix = asp.detail.map(a => [a.score, ...ov.competitors.map(c => c.per[a.key])]);
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">${timeFilterHTML()}<span class="tiny">数据来源：公开平台周度快照（竞品为降级采集）</span></div>
  <div class="grid cols-2">
    <div class="m3-card elevated"><div class="card-title"><span class="t">健康度排行（EBHI）</span></div>
      <div id="cpRank"></div>
      ${insight(`竞品 <b>${ov.competitors[0].name}</b> 以 ${ov.competitors[0].ebhi} 分居首；我方 ${ov.ebhi.total} 分列第 ${1 + ov.competitors.filter(c => c.ebhi > ov.ebhi.total).length + 0} 位`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">差距最大方面（我方 vs 最优竞品）</span></div>
      ${asp.detail.map(a => { const best = Math.max(a.score, ...ov.competitors.map(c => c.per[a.key])); return `<div class="row between" style="padding:4px 0"><span class="m3-body-s">${a.name}</span><span class="row" style="gap:6px"><b class="m3-num m3-body-s" style="color:${ebhiColor(a.score)}">${a.score}</b><span class="tiny">vs 最优 ${best}（${a.score - best >= 0 ? '+' : ''}${a.score - best}）</span></span></div>`; }).join('')}
      ${insight('“薪酬福利”“工作强度”与竞品差距显著，是候选人 offer 比较中的直接失分项')}
    </div>
  </div>
  <div class="m3-card elevated mt16"><div class="card-title"><span class="t">方面 × 企业横评热力图</span><span class="tiny">红=落后 绿=领先（0-100）</span></div>
    <div id="cpHeat"></div>
    ${insight('竞品被夸而我们被骂的方面集中在「工作强度与平衡」；「办公环境」为我方差异化优势，建议对外传播')}
  </div>`;
  bindTimeFilter(root, route);
  Charts.hbars($('#cpRank'), [{ label: state.company.shortName + '（我方）', value: ov.ebhi.total }, ...ov.competitors.map(c => ({ label: c.name, value: c.ebhi }))]);
  Charts.heatmap($('#cpHeat'), asp.detail.map(a => a.name), cols, matrix);
}

/* ================= 候选人视角 ================= */
async function pgCandidate(root) {
  root.innerHTML = `<div class="empty">加载中…</div>`;
  const d = await api.get(`/api/dashboard/candidate?days=${state.days}`);
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">${timeFilterHTML()}</div>
  <div class="grid cols-3">
    <div class="m3-card elevated"><div class="card-title"><span class="t">候选人口碑净情感</span></div>
      <div class="m3-display-s m3-num" style="color:${ebhiColor(Math.round(d.posRate * 100))}">${Math.round(d.posRate * 100)}<span style="font-size:20px">%</span></div>
      <div class="tiny mt8">正面 ${d.pos} / 负面 ${d.neg}（共 ${d.total} 条候选人口吻内容）</div>
      ${insight(`候选人口碑${d.posRate < .4 ? '偏负，offer 竞争处于劣势，建议优先修复 TA 视角的负面话题' : '总体健康，可加大校招内容投放'}`)}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">offer 讨论热度（近 30 天）</span></div><div id="cdOffer"></div>
      ${insight('offer 比较类内容热度与招聘季节奏吻合，建议在 offer 沟通话术中前置回应薪酬透明度问题')}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">面试体验星级分布</span></div><div id="cdStars"></div>
      ${insight('3 星以下占比偏高，主要抱怨“流程长、反馈慢”，建议 SLA 化面试反馈时效')}
    </div>
  </div>
  <div class="grid cols-2 mt16">
    <div class="m3-card elevated"><div class="card-title"><span class="t">“避雷”关键词监控</span></div>
      <div class="wordcloud" style="padding:16px 0">${d.avoidWords.map((w, i) => `<span class="m3-chip" style="border-color:${i < 3 ? 'var(--sem-neg)' : 'var(--m3-outline-variant)'};color:${i < 3 ? 'var(--sem-neg)' : 'inherit'};font-size:${i < 3 ? 14 : 12}px">${i < 3 ? '⚠ ' : ''}${w.text} <b class="m3-num">${w.w}</b></span>`).join('')}</div>
      ${insight('「避雷」「毁约」为高风险词，命中时应同步触发预警规则（见预警中心）')}
    </div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">候选人语录（按影响力排序）</span></div>
      <div class="m3-list">${d.quotes.slice(0, 5).map(m => `<div class="quote-card ${m.sentiment.polarity === 'neg' ? 'neg' : m.sentiment.polarity === 'pos' ? 'pos' : ''}" style="margin-bottom:8px">
        <div class="q-text">“${m.text}”</div>
        <div class="q-meta"><span class="badge ${m.sentiment.polarity}">${POL_NAMES[m.sentiment.polarity]}</span><span>${platName(m.platform)}</span><span>候选人</span><span>影响力 ${m.influence}</span><span>${fmtTime(m.time)}</span></div></div>`).join('')}</div>
    </div>
  </div>`;
  bindTimeFilter(root, route);
  Charts.stackedBars($('#cdOffer'), d.offerHeat, { h: 180 });
  Charts.stars($('#cdStars'), d.stars);
}

/* ================= 预警中心 ================= */
async function pgAlerts(root) {
  const [alerts, events] = await Promise.all([api.get('/api/alerts'), api.get('/api/events')]);
  const active = alerts.filter(a => a.status === 'active'), resolved = alerts.filter(a => a.status !== 'active');
  const lvName = { red: '紧急', yellow: '关注', blue: '提示' };
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">
    <div class="row"><span class="m3-title-m">活跃预警</span><span class="badge red">${active.filter(a => a.level === 'red').length} 紧急</span><span class="badge yellow">${active.filter(a => a.level === 'yellow').length} 关注</span><span class="badge blue">${active.filter(a => a.level === 'blue').length} 提示</span></div>
    <span class="tiny">紧急级预警 30 分钟未确认将升级通知上级（F-ALR-02）</span></div>
  ${active.map(a => `
  <div class="m3-card elevated" style="border-left:4px solid var(--${a.level === 'red' ? 'sem-neg' : a.level === 'yellow' ? 'sem-warn' : 'sem-info'})">
    <div class="row between"><div class="row"><span class="badge ${a.level}">${lvName[a.level]}</span><span class="m3-title-s">${a.title}</span></div>
      <span class="tiny">${fmtTime(a.triggeredAt)}</span></div>
    <div class="tiny mt8">规则：${a.rule} · 指标：${a.metric} · 方面：${ASPECT_NAMES[a.aspect] || '—'}</div>
    <div class="row mt8">
      ${a.status === 'active' && !a.ackBy ? `<button class="m3-btn filled sm" data-ack="${a.id}">确认预警</button>` : `<span class="badge pos">已确认 ${a.ackBy || ''}</span>`}
      <button class="m3-btn tonal sm" data-sop="${a.id}">生成对策（SOP）</button>
      ${a.eventId ? `<button class="m3-btn outlined sm" data-event="${a.eventId}">查看事件档案</button>` : `<button class="m3-btn text sm" data-newevent="${a.id}">建立事件档案</button>`}
    </div></div>`).join('')}
  <div class="m3-title-l mt24" style="font-size:18px">事件档案（时间线）</div>
  ${events.map(e => `
  <div class="m3-card outlined mt16">
    <div class="row between"><span class="m3-title-m">${e.title}</span><span class="badge ${e.status === 'ongoing' ? 'yellow' : 'pos'}">${e.status === 'ongoing' ? '进行中' : '已平息'}</span></div>
    <div class="grid cols-2 mt16"><div class="timeline">${e.timeline.map(t => `<div class="tl-item"><div class="tl-label">${t.label}</div><div class="tl-time">${fmtTime(t.t)}</div><div class="m3-body-s">${t.desc}</div></div>`).join('')}</div>
    <div><div class="tiny" style="font-weight:700;margin-bottom:8px">参与平台</div><div class="row">${e.platforms.map(p => `<span class="m3-chip">${p}</span>`).join('')}</div>
      <div class="tiny mt16" style="font-weight:700;margin-bottom:8px">处置动作（人工补充）</div>
      ${e.handling.map(h => `<div class="m3-body-s row" style="gap:6px"><span class="badge pos">已执行</span>${h}</div>`).join('')}</div></div>
  </div>`).join('')}
  ${resolved.length ? `<div class="m3-title-m mt24">历史预警</div><table class="m3-table mt8"><thead><tr><th>级别</th><th>标题</th><th>触发时间</th><th>确认</th></tr></thead><tbody>${resolved.map(a => `<tr><td><span class="badge ${a.level}">${lvName[a.level]}</span></td><td>${a.title}</td><td class="tiny">${fmtTime(a.triggeredAt)}</td><td class="tiny">${a.ackBy || '—'}</td></tr>`).join('')}</tbody></table>` : ''}`;
  $$('[data-ack]', root).forEach(b => b.onclick = async () => { await api.send(`/api/alerts/${b.dataset.ack}/ack`, 'POST'); snackbar('已确认预警，回执已记录'); route(); });
  $$('[data-sop]', root).forEach(b => b.onclick = () => { const a = alerts.find(x => x.id === b.dataset.sop); openStrategyDialog({ aspect: a.aspect, topic: a.rule, alertId: a.id, crisis: true }); });
  $$('[data-event]', root).forEach(b => b.onclick = () => snackbar('事件档案见下方时间线区块'));
  $$('[data-newevent]', root).forEach(b => b.onclick = () => snackbar('事件档案已创建（演示）：首发现帖已自动归档'));
}

/* ================= 原声明细 ================= */
async function pgMentions(root) {
  const f = { aspect: sessionStorage.getItem('eb-filter-aspect') || '', polarity: '', platform: '', q: '' };
  sessionStorage.removeItem('eb-filter-aspect');
  async function render(list) {
    const params = new URLSearchParams({ days: state.days, ...(f.aspect && { aspect: f.aspect }), ...(f.polarity && { polarity: f.polarity }), ...(f.platform && { platform: f.platform }), ...(f.q && { q: f.q }) });
    const d = await api.get('/api/mentions?' + params);
    list.innerHTML = `
    <div class="row between" style="margin-bottom:14px">${timeFilterHTML()}
      <div class="row"><input id="msQ" class="m3-field-input" placeholder="搜索关键词…" value="${f.q}" style="height:36px;border-radius:20px;border:1px solid var(--m3-outline);background:transparent;color:inherit;padding:0 16px;font-family:inherit;outline:none">
      <button class="m3-btn filled sm" id="msSearch">搜索</button>
      <button class="m3-btn tonal sm" id="msEvidence">证据夹（${state.evidence.length}）</button></div></div>
    <div class="row" style="margin-bottom:12px">
      ${['', 'pos', 'neu', 'neg'].map(p => `<button class="m3-chip ${f.polarity === p ? 'selected' : ''}" data-pol="${p}">${p ? POL_NAMES[p] : '全部情感'}</button>`).join('')}
      <span style="width:8px"></span>
      ${[['', '全部方面'], ...Object.entries(ASPECT_NAMES).map(([k, n]) => [k, n])].map(([k, n]) => `<button class="m3-chip ${f.aspect === k ? 'selected' : ''}" data-asp="${k}">${n}</button>`).join('')}
    </div>
    <div class="m3-card outlined" style="padding:0"><div style="padding:12px 16px;border-bottom:1px solid var(--m3-outline-variant)" class="row between">
      <span class="m3-label-m">共 ${d.total} 条（已脱敏 · 展示前 ${d.items.length} 条）</span><span class="tiny">标记“误判”将回流训练集（F-DP-04）</span></div>
      <div style="padding:8px 12px">
      ${d.items.map(m => `<div class="m3-list-item" data-id="${m.id}">
        <div style="flex:1;min-width:0">
          <div class="m3-body-m">${m.text}</div>
          <div class="row q-meta" style="margin-top:6px;gap:8px">
            <span class="badge ${m.sentiment.polarity}">${POL_NAMES[m.sentiment.polarity]}·强度${m.sentiment.intensity}</span>
            ${m.aspects.map(a => `<span class="badge neu">${ASPECT_NAMES[a.key]}·${POL_NAMES[a.polarity]}</span>`).join('')}
            <span class="tiny">${platName(m.platform)} · ${m.audience} · 用户${m.authorHash} · ${fmtTime(m.time)} · 赞${m.likes} · 影响力${m.influence}</span></div></div>
        <div class="row" style="flex-direction:column;gap:6px">
          <button class="m3-btn ${m.flags.evidence ? 'filled' : 'tonal'} sm" data-ev="${m.id}">${m.flags.evidence ? '✓ 已加入' : '＋ 证据夹'}</button>
          <button class="m3-btn ${m.flags.misjudge ? 'danger' : 'text'} sm" data-mj="${m.id}">${m.flags.misjudge ? '撤销误判' : '标记误判'}</button></div>
      </div>`).join('') || '<div class="empty">无匹配内容</div>'}
      </div></div>`;
    bindTimeFilter(list, () => route());
    $$('[data-pol]', list).forEach(b => b.onclick = () => { f.polarity = b.dataset.pol; render(list); });
    $$('[data-asp]', list).forEach(b => b.onclick = () => { f.aspect = b.dataset.asp; render(list); });
    $('#msSearch', list).onclick = () => { f.q = $('#msQ', list).value.trim(); render(list); };
    $('#msQ', list).onkeydown = (e) => { if (e.key === 'Enter') { f.q = e.target.value.trim(); render(list); } };
    $('#msEvidence', list).onclick = () => openEvidenceDialog();
    $$('[data-ev]', list).forEach(b => b.onclick = async () => { const m = await api.send(`/api/mentions/${b.dataset.ev}`, 'PATCH', { evidence: true }); state.evidence = [...new Set([...state.evidence, m.id])]; snackbar('已加入报告证据夹'); render(list); renderNav(0); });
    $$('[data-mj]', list).forEach(b => b.onclick = async () => { await api.send(`/api/mentions/${b.dataset.mj}`, 'PATCH', { misjudge: true }); snackbar('已标记误判，样本将回流训练集'); render(list); });
  }
  const wrap = document.createElement('div'); root.appendChild(wrap); render(wrap);
}

function openEvidenceDialog() {
  const dlg = dialog('报告证据夹', '已加入证据夹的原声将出现在下一份报告的“根因分析”章节');
  dlg.body.innerHTML = state.evidence.length ? `<div class="m3-list">${state.evidence.map(id => `<div class="m3-list-item m3-body-m">${id}</div>`).join('')}</div>` : '<div class="empty">证据夹为空，可在原声明细页添加</div>';
  dlg.actions([`<button class="m3-btn text" id="dlgClose">关闭</button>`]);
  $('#dlgClose').onclick = () => dlg.close();
}

/* ================= 行动看板 ================= */
async function pgActions(root) {
  const items = await api.get('/api/actions');
  const cols = [['todo', '待启动'], ['doing', '进行中'], ['done', '已完成'], ['parked', '已搁置']];
  const overdue = (t) => t.due < Date.now() && t.status !== 'done';
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">
    <div class="row"><span class="m3-title-m">行动闭环看板</span><span class="badge red">${items.filter(overdue).length} 逾期</span></div>
    <button class="m3-btn filled sm" id="actNew">＋ 新建任务</button></div>
  <div class="row" style="margin-bottom:12px">
    <span class="m3-chip"><span class="dot" style="background:var(--sem-neg)"></span>止血</span>
    <span class="m3-chip"><span class="dot" style="background:var(--sem-warn)"></span>修复</span>
    <span class="m3-chip"><span class="dot" style="background:var(--sem-pos)"></span>增值</span>
    <span class="tiny">拖拽任务卡可在状态间流转；搁置任务需填写原因（F-ACT-02）</span></div>
  <div class="kanban">${cols.map(([k, name]) => `
    <div class="kanban-col" data-col="${k}"><h4>${name}<span>${items.filter(t => t.status === k).length}</span></h4>
      ${items.filter(t => t.status === k).map(t => `
      <div class="task-card ${overdue(t) ? 'overdue' : ''}" draggable="true" data-id="${t.id}" data-layer="${t.layer}">
        <div class="t-title">${t.title}</div>
        <div class="row" style="gap:6px"><span class="badge ${t.layer === '止血' ? 'red' : t.layer === '修复' ? 'yellow' : 'pos'}">${t.layer}</span>
          ${t.aspect ? `<span class="badge neu">${ASPECT_NAMES[t.aspect]}</span>` : ''}
          ${overdue(t) ? '<span class="badge red">逾期</span>' : ''}</div>
        <div class="tiny mt8">负责人 ${t.owner} · 截止 ${fmtDue(t.due)}</div>
        ${t.progress ? `<div class="progress-track"><div class="progress-fill" style="width:${t.progress}%"></div></div><div class="tiny mt8" style="text-align:right">${t.progress}%</div>` : ''}
        ${t.parkReason ? `<div class="tiny mt8">搁置原因：${t.parkReason}</div>` : ''}
        ${t.effect ? `<div class="insight-line" style="margin-top:8px"><span class="tag">复盘</span><span>${t.effect.verdict}（${t.effect.before} → ${t.effect.after} 分 / 30 天）</span></div>` : ''}
        <div class="tiny mt8" style="color:var(--m3-primary)">验收：${t.acceptance || '—'}</div>
      </div>`).join('') || '<div class="empty" style="padding:16px 0">—</div>'}
    </div>`).join('')}</div>`;
  // 拖拽流转
  let dragId = null;
  $$('.task-card', root).forEach(c => {
    c.ondragstart = () => { dragId = c.dataset.id; c.classList.add('dragging'); };
    c.ondragend = () => c.classList.remove('dragging');
    c.ondblclick = () => openTaskDialog(items.find(i => i.id === c.dataset.id));
  });
  $$('.kanban-col', root).forEach(col => {
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = async (e) => {
      e.preventDefault();
      const status = col.dataset.col;
      const t = items.find(i => i.id === dragId); if (!t || t.status === status) return;
      if (status === 'done') t.progress = 100;
      if (status === 'parked' && !t.parkReason) t.parkReason = window.prompt('搁置需填写原因：') || '待补充';
      await api.send(`/api/actions/${dragId}`, 'PATCH', { status, ...(status === 'parked' ? { parkReason: t.parkReason } : {}) });
      snackbar(`任务已流转至「${cols.find(c => c[0] === status)[1]}」`);
      route();
    };
  });
  $('#actNew').onclick = () => openTaskDialog(null);
}

function openTaskDialog(t) {
  const isNew = !t;
  const dlg = dialog(isNew ? '新建行动任务' : '任务详情', isNew ? '对策确认后转为可跟踪任务' : '');
  dlg.body.innerHTML = `
    <div class="m3-field"><label>任务标题</label><input id="tkTitle" value="${t ? t.title : ''}"></div>
    <div class="grid cols-2 mt8" style="gap:10px">
      <div class="m3-field"><label>行动分层</label><select id="tkLayer">${['止血', '修复', '增值'].map(l => `<option ${t && t.layer === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="m3-field"><label>针对方面</label><select id="tkAspect"><option value="">—</option>${Object.entries(ASPECT_NAMES).map(([k, n]) => `<option value="${k}" ${t && t.aspect === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="m3-field"><label>负责人</label><input id="tkOwner" value="${t ? t.owner : ''}" placeholder="角色·姓名"></div>
      <div class="m3-field"><label>截止日期</label><input id="tkDue" type="date" value="${t ? new Date(t.due).toISOString().slice(0, 10) : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)}"></div>
    </div>
    <div class="m3-field mt8"><label>验收标准</label><textarea id="tkAcc" rows="2">${t ? t.acceptance : ''}</textarea></div>`;
  dlg.actions([`<button class="m3-btn text" id="dlgCancel">取消</button>`, `<button class="m3-btn filled" id="dlgSave">${isNew ? '创建' : '保存'}</button>`]);
  $('#dlgCancel').onclick = () => dlg.close();
  $('#dlgSave').onclick = async () => {
    const payload = {
      title: $('#tkTitle').value, layer: $('#tkLayer').value, aspect: $('#tkAspect').value || null,
      owner: $('#tkOwner').value, due: new Date($('#tkDue').value).getTime(), acceptance: $('#tkAcc').value,
    };
    if (isNew) await api.send('/api/actions', 'POST', payload);
    else await api.send(`/api/actions/${t.id}`, 'PATCH', payload);
    dlg.close(); snackbar(isNew ? '任务已创建' : '任务已更新'); route();
  };
}

/* ================= 分析报告 ================= */
async function pgReports(root) {
  const reports = await api.get('/api/reports');
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px">
    <div class="row"><span class="m3-title-m">深度分析报告</span><span class="tiny">周报每周一 9:00 自动生成 · 月报每月 1 日自动生成</span></div>
    <div class="row"><select id="rpDays" class="m3-field-select" style="height:36px;border-radius:20px;border:1px solid var(--m3-outline);background:transparent;color:inherit;padding:0 12px">
      <option value="7">近 7 天</option><option value="30" selected>近 30 天</option><option value="90">近 90 天</option></select>
      <button class="m3-btn filled sm" id="rpGen">✦ AI 生成本期报告</button></div></div>
  ${reports.length ? reports.map(r => `
  <div class="m3-card elevated mt8" style="cursor:pointer" data-rp="${r.id}">
    <div class="row between"><div class="row"><span class="badge blue">${r.type}</span><span class="m3-title-s">${r.range[0]} ~ ${r.range[1]}</span></div>
      <span class="tiny">${fmtTime(r.createdAt)} · AI 生成（可人工修订）</span></div>
    <div class="m3-body-s mt8">${r.sections[0].conclusion}</div>
  </div>`).join('') : '<div class="empty">暂无报告，点击右上角生成</div>'}`;
  $('#rpGen').onclick = async () => { snackbar('LLM 正在撰写分析文本…'); const r = await api.send('/api/reports/generate', 'POST', { days: +$('#rpDays').value, type: '定制报告' }); snackbar('报告已生成'); route(); openReport(r); };
  $$('[data-rp]', root).forEach(el => el.onclick = () => openReport(reports.find(r => r.id === el.dataset.rp)));
}
function openReport(r) {
  const dlg = dialog(`《${r.type}》`, `${r.range[0]} ~ ${r.range[1]} · AI 生成，所有结论可溯源`);
  dlg.body.innerHTML = r.sections.map(s => `
    <div class="mt16"><div class="m3-title-m">${s.title}</div>
    <div class="insight-line"><span class="tag">结论</span><span>${s.conclusion}</span></div>
    ${s.detail ? `<table class="m3-table mt8"><thead><tr><th>方面</th><th>得分</th><th>竞品均值</th><th>正面</th><th>负面</th></tr></thead><tbody>${s.detail.map(d => `<tr><td>${d.name}</td><td class="m3-num" style="color:${ebhiColor(d.score)};font-weight:700">${d.score}</td><td class="m3-num">${d.compAvg}</td><td class="m3-num">${d.pos}</td><td class="m3-num">${d.neg}</td></tr>`).join('')}</tbody></table>` : ''}
    ${s.evidence ? `<div class="tiny mt8" style="color:var(--m3-primary);cursor:pointer" data-ev>📎 查看证据帖文（${s.evidence.length} 条，可溯源）</div>` : ''}
    </div>`).join('') + `<div class="row mt16" style="justify-content:flex-end"><button class="m3-btn filled" id="rpAct">⚡ 一键生成行动计划</button></div>`;
  dlg.actions([]);
  $$('[data-ev]', dlg.body).forEach(e => e.onclick = () => { dlg.close(); location.hash = '#/mentions'; });
  $('#rpAct').onclick = async () => {
    dlg.close();
    const res = await api.send('/api/strategies', 'POST', { aspect: 'workload', topic: r.topic });
    openStrategyDialog({ aspect: 'workload', topic: r.topic }, res.strategies);
  };
}

/* ================= 配置中心（企业背景向导） ================= */
async function pgSettings(root) {
  const c = state.company;
  root.innerHTML = `
  <div class="row between" style="margin-bottom:16px"><span class="m3-title-m">企业背景配置（F-CFG-01~03）</span>
    <button class="m3-btn outlined sm" id="cfgWizard">重新运行配置向导</button></div>
  <div class="grid cols-2">
    <div class="m3-card elevated"><div class="card-title"><span class="t">企业主体</span></div>
      <div class="m3-list">
        ${[['法定名称', c.name], ['常用简称', c.shortName], ['英文名', c.enName], ['曾用名', c.aliases.join('、')], ['行业', c.industry], ['规模', c.size], ['总部', c.hq || '—'], ['业务品牌', (c.subsidiaries || []).join('、')], ['旗下产品', (c.brands || []).join('、')], ['高管', c.execs.map(e => `${e.name}（${e.title}）`).join('、')]].map(([k, v]) => `<div class="row between" style="padding:5px 0"><span class="tiny">${k}</span><span class="m3-body-s" style="font-weight:600">${v}</span></div>`).join('')}
      </div></div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">监测关键词组（系统生成 · 已确认）</span></div>
      <div class="m3-body-s">必须匹配词：</div><div class="row mt8">${c.keywords.must.map(k => `<span class="m3-chip selected">${k}</span>`).join('')}</div>
      <div class="m3-body-s mt8">排除词：</div><div class="row mt8">${c.keywords.exclude.map(k => `<span class="m3-chip">${k}</span>`).join('')}</div>
      <div class="row mt16"><button class="m3-btn tonal sm" id="kwTest">试跑校准（近 7 天样本量）</button><span id="kwResult" class="tiny"></span></div></div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">监测方面与战略权重</span></div>
      ${c.aspects.filter(a => a.enabled).map(a => `<div class="row between" style="padding:4px 0"><span class="m3-body-s">${a.name}</span><span class="badge blue">权重 ×${c.weights[a.key]}</span></div>`).join('')}
      <div class="tiny mt8">校招季可提高“职业发展”权重（保存后 EBHI 立即重算）</div></div>
    <div class="m3-card elevated"><div class="card-title"><span class="t">竞品对标（${c.competitors.filter(x => x.enabled).length} 家）</span></div>
      ${c.competitors.map(x => `<div class="row between" style="padding:4px 0"><span class="m3-body-s">${x.name}</span><span class="m3-switch ${x.enabled ? 'on' : ''}" data-comp="${x.key}"></span></div>`).join('')}
      <div class="tiny mt8">竞品为降级采集（周度快照），关闭后不计入对标</div></div>
  </div>
  <div class="m3-card outlined mt16"><div class="card-title"><span class="t">采集合规状态（F-COL-02）</span><span class="badge pos">合规运行中</span></div>
    <div class="grid cols-3">
      <div class="m3-body-s">✓ 仅采集未登录公开内容</div><div class="m3-body-s">✓ 入库即去标识化（昵称哈希）</div><div class="m3-body-s">✓ 全局合规配额限速</div>
      <div class="m3-body-s">✓ PIPL / 数据安全法 DPIA 已归档</div><div class="m3-body-s">✓ GDPR（海外区）评估通过</div><div class="m3-body-s">✓ 采集审计日志全覆盖</div>
    </div></div>
  <div class="m3-card outlined mt16"><div class="card-title"><span class="t">审计日志（最近 8 条）</span></div><div id="auditList" class="tiny">加载中…</div></div>`;
  $('#kwTest').onclick = async () => {
    $('#kwResult').textContent = '试跑中…';
    const r = await api.send('/api/company/keywords/preview', 'POST', { must: c.keywords.must });
    $('#kwResult').innerHTML = `<b>日均值 ${r.estimatedPerDay} 条</b> · 无关率 ${Math.round(r.irrelevantRate * 100)}% · ${r.advice}`;
  };
  $$('[data-comp]', root).forEach(s => s.onclick = async () => {
    s.classList.toggle('on');
    const comp = c.competitors.find(x => x.key === s.dataset.comp);
    comp.enabled = s.classList.contains('on');
    await api.send('/api/company', 'PUT', c);
    snackbar(`${comp.name} 已${comp.enabled ? '开启' : '暂停'}对标`);
  });
  $('#cfgWizard').onclick = () => openWizard();
  api.get('/api/audit').then(logs => {
    $('#auditList').innerHTML = logs.slice(0, 8).map(l => `<div class="row between" style="padding:3px 0"><span>${l.action}</span><span class="muted">${l.actor} · ${fmtTime(l.t)}</span></div>`).join('');
  });
}

function openWizard() {
  const c = { ...state.company, keywords: { ...state.company.keywords } };
  let step = 0;
  const steps = ['企业主体', '监测方面', '竞品与权重', '关键词确认'];
  const dlg = dialog('企业背景配置向导', '约 15 分钟完成（演示版预填了当前配置）');
  function render() {
    $$('.step-dot', dlg.el).forEach((d, i) => d.classList.toggle('done', i <= step));
    const body = [
      `<div class="grid cols-2" style="gap:10px">
        <div class="m3-field"><label>企业法定名称</label><input id="wName" value="${c.name}"></div>
        <div class="m3-field"><label>常用简称</label><input id="wShort" value="${c.shortName}"></div>
        <div class="m3-field"><label>英文名</label><input id="wEn" value="${c.enName}"></div>
        <div class="m3-field"><label>行业 / 规模</label><input id="wInd" value="${c.industry} · ${c.size}"></div></div>`,
      `<div class="tiny" style="margin-bottom:8px">勾选需要监测口碑的方面：</div>
        <div class="row">${Object.entries(ASPECT_NAMES).map(([k, n]) => `<button class="m3-chip ${c.aspects.find(a => a.key === k)?.enabled ? 'selected' : ''}" data-wasp="${k}">${n}</button>`).join('')}</div>`,
      `<div class="tiny" style="margin-bottom:8px">竞品对标（默认 3—5 家）：</div>
        <div class="m3-list">${c.competitors.map(x => `<div class="row between" style="padding:4px 0"><span>${x.name}</span><span class="m3-switch ${x.enabled ? 'on' : ''}" data-wcomp="${x.key}"></span></div>`).join('')}</div>`,
      `<div class="tiny" style="margin-bottom:8px">系统根据主体信息生成关键词组草案：</div>
        <div class="m3-body-s">必须匹配词</div><div class="row mt8" id="wMust">${c.keywords.must.map(k => `<span class="m3-chip selected">${k}</span>`).join('')}</div>
        <div class="m3-body-s mt8">排除词（同名消歧）</div><div class="row mt8">${c.keywords.exclude.map(k => `<span class="m3-chip">${k}</span>`).join('')}</div>
        <div class="row mt16"><button class="m3-btn tonal sm" id="wTest">▶ 一键试跑（最近 7 天）</button><span class="tiny" id="wTestR"></span></div>`,
    ][step];
    dlg.body.innerHTML = `<div class="stepper">${steps.map(() => `<div class="step-dot"></div>`).join('')}</div>
      <div class="m3-title-m" style="margin-bottom:12px">第 ${step + 1} 步 · ${steps[step]}</div>${body}`;
    dlg.actions([
      `<button class="m3-btn text" id="wCancel">取消</button>`,
      step > 0 ? `<button class="m3-btn outlined" id="wPrev">上一步</button>` : '',
      step < 3 ? `<button class="m3-btn filled" id="wNext">下一步</button>` : `<button class="m3-btn filled" id="wDone">启动监测</button>`,
    ].join(''));
    $('#wCancel').onclick = () => dlg.close();
    if ($('#wPrev')) $('#wPrev').onclick = () => { collect(); step--; render(); };
    if ($('#wNext')) $('#wNext').onclick = () => { collect(); step++; render(); };
    if ($('#wDone')) $('#wDone').onclick = async () => {
      collect();
      await api.send('/api/company', 'PUT', c);
      state.company = await api.get('/api/company');
      dlg.close(); snackbar('配置已保存，监测已启动（增量采集 P95 ≤ 30 分钟）'); route();
    };
    $$('[data-wasp]', dlg.body).forEach(b => b.onclick = () => { const a = c.aspects.find(x => x.key === b.dataset.wasp); a.enabled = !a.enabled; b.classList.toggle('selected'); });
    $$('[data-wcomp]', dlg.body).forEach(s => s.onclick = () => { const x = c.competitors.find(y => y.key === s.dataset.wcomp); x.enabled = !x.enabled; s.classList.toggle('on'); });
    if ($('#wTest')) $('#wTest').onclick = async () => {
      $('#wTestR').textContent = '试跑中…';
      const r = await api.send('/api/company/keywords/preview', 'POST', { must: c.keywords.must });
      $('#wTestR').innerHTML = `日均 ${r.estimatedPerDay} 条 · 无关率 ${Math.round(r.irrelevantRate * 100)}%`;
    };
    function collect() {
      if (step === 0 && $('#wName')) {
        c.name = $('#wName').value; c.shortName = $('#wShort').value; c.enName = $('#wEn').value;
        const [ind, size] = $('#wInd').value.split(' · '); c.industry = ind; c.size = size || c.size;
        c.keywords.must = [c.name, c.shortName, c.enName].filter(Boolean);
      }
    }
  }
  render();
}

/* ================= AI 对策对话框（F-ACT-01） ================= */
async function openStrategyDialog(input, preset) {
  const res = preset || (await api.send('/api/strategies', 'POST', input)).strategies;
  const dlg = dialog('AI 对策建议', `针对：${input.topic || '综合'} ${input.crisis ? '· 已套用危机 SOP 模板' : ''} · 按“止血—修复—增值”分层`);
  dlg.body.innerHTML = res.map((s, i) => `
    <div class="m3-card outlined mt8" style="border-left:4px solid var(--${s.layer === '止血' ? 'sem-neg' : s.layer === '修复' ? 'sem-warn' : 'sem-pos'})">
      <div class="row between"><div class="row"><span class="badge ${s.layer === '止血' ? 'red' : s.layer === '修复' ? 'yellow' : 'pos'}">${s.layer}</span><span class="m3-title-s">${s.title}</span></div>
        <button class="m3-btn tonal sm" data-adopt='${JSON.stringify(s).replace(/'/g, '&#39;')}'>转为任务</button></div>
      <div class="tiny mt8">责任角色：${s.owner} · 时间框：${s.timebox} · 预期效果：${s.expect}</div>
      <div class="tiny mt8" style="color:var(--sem-warn)">⚠ 风险提示：${s.risk}</div>
    </div>`).join('') + `<div class="tiny mt16" style="text-align:right">AI 生成内容，需人工确认后执行</div>`;
  dlg.actions([`<button class="m3-btn text" id="stClose">关闭</button>`]);
  $('#stClose').onclick = () => dlg.close();
  $$('[data-adopt]', dlg.body).forEach(b => b.onclick = async () => {
    const s = JSON.parse(b.dataset.adopt);
    await api.send('/api/actions', 'POST', {
      title: s.title, layer: s.layer, aspect: input.aspect || null, owner: `待分派（建议：${s.owner}）`,
      role: s.owner, acceptance: s.expect, linked: input.alertId || null, due: Date.now() + (s.layer === '止血' ? 2 : s.layer === '修复' ? 14 : 30) * 864e5,
    });
    b.textContent = '✓ 已创建'; b.disabled = true;
    snackbar('已转为行动任务，见行动看板');
  });
}

/* ================= 对话框基类 ================= */
function dialog(title, sub) {
  const el = document.createElement('div');
  el.className = 'scrim';
  el.innerHTML = `<div class="m3-dialog"><h2>${title}</h2><div class="dialog-sub">${sub || ''}</div><div class="dlg-body"></div><div class="dialog-actions"></div></div>`;
  document.body.appendChild(el);
  el.onclick = (e) => { if (e.target === el) el.remove(); };
  return { el, get body() { return $('.dlg-body', el); }, actions(html) { $('.dialog-actions', el).innerHTML = html; }, close() { el.remove(); } };
}

/* ================= 启动 ================= */
(async function init() {
  state.company = await api.get('/api/company');
  if (!state.company.configured) { openWizard(); }
  route();
})();
