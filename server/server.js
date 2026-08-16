// server.js — 零依赖 Node HTTP 服务：REST API + 静态资源
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const store = require('./store');

const PORT = process.env.PORT || 8321;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

const db = store.load();
const { ASPECTS, PLATFORMS } = store;

// ---------- 工具 ----------
const DAY = 86400000;
function sinceDays(days) { return Date.now() - days * DAY; }
function inWindow(mentions, days) { const s = sinceDays(days); return mentions.filter(m => m.time >= s); }

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf-8')); } catch { return {}; }
}

// ---------- 聚合分析 ----------
function compAspectMatrix(days) {
  // 竞品方面情感分矩阵（近 N 天）
  return db.company.competitors.map(c => {
    const rows = db.compDaily.filter(r => r.comp === c.key && r.daysAgo < days);
    const per = {};
    for (const a of ASPECTS) {
      const rs = rows.filter(r => r.aspect === a.key);
      const pos = rs.reduce((x, r) => x + r.pos, 0), neg = rs.reduce((x, r) => x + r.neg, 0), neu = rs.reduce((x, r) => x + r.neu, 0);
      const total = pos + neg + neu;
      per[a.key] = total ? Math.round(50 + ((pos - neg) / total) * 50) : 50;
    }
    const ebhi = Math.round(Object.values(per).reduce((x, v) => x + v, 0) / ASPECTS.length * 0.94);
    return { key: c.key, name: c.name, per, ebhi };
  });
}

function selfMentions() { return db.mentions; }

function overview(days) {
  const ms = inWindow(selfMentions(), days);
  const ebhi = store.calcEBHI(ms, db.company.weights);
  // 上一周期 EBHI（对比）
  const prevMs = selfMentions().filter(m => m.time >= sinceDays(days * 2) && m.time < sinceDays(days));
  const prevEbhi = store.calcEBHI(prevMs, db.company.weights);
  const pos = ms.filter(m => m.sentiment.polarity === 'pos').length;
  const neg = ms.filter(m => m.sentiment.polarity === 'neg').length;
  const neu = ms.length - pos - neg;
  // 热点话题 Top10
  const topicMap = {};
  for (const m of ms) {
    topicMap[m.topic] = topicMap[m.topic] || { topic: m.topic, count: 0, neg: 0, total: 0 };
    const t = topicMap[m.topic]; t.count++; t.total++;
    if (m.sentiment.polarity === 'neg') t.neg++;
  }
  const topics = Object.values(topicMap).sort((a, b) => b.count - a.count).slice(0, 10)
    .map(t => ({ ...t, negRate: +(t.neg / t.total).toFixed(2) }));
  // 区域分布（中国为主）
  const region = { cn: ms.filter(m => m.region === 'cn').length, global: ms.filter(m => m.region === 'global').length };
  const cnNeg = ms.filter(m => m.region === 'cn' && m.sentiment.polarity === 'neg').length;
  const glNeg = ms.filter(m => m.region === 'global' && m.sentiment.polarity === 'neg').length;
  // 平台分布
  const byPlatform = PLATFORMS.map(p => {
    const list = ms.filter(m => m.platform === p.key);
    const p2 = list.filter(m => m.sentiment.polarity === 'pos').length;
    const n2 = list.filter(m => m.sentiment.polarity === 'neg').length;
    return { key: p.key, name: p.name, region: p.region, count: list.length, negRate: list.length ? +(n2 / list.length).toFixed(2) : 0, pos, posRate: list.length ? +(p2 / list.length).toFixed(2) : 0 };
  }).sort((a, b) => b.count - a.count);
  // 声量份额 SOV
  const selfVol = ms.length;
  const compVol = db.company.competitors.length * Math.round(selfVol * 0.82);
  const sov = +(selfVol / (selfVol + compVol)).toFixed(3);
  return {
    days,
    ebhi: { ...ebhi, prev: prevEbhi.total, delta: ebhi.total - prevEbhi.total },
    volume: { total: ms.length, pos, neg, neu, nsr: +(((pos - neg) / (ms.length || 1)).toFixed(3)) },
    sov,
    series: store.dailySeries(ms, days),
    topics, region: {
      cn: region.cn, global: region.global,
      cnNegRate: region.cn ? +(cnNeg / region.cn).toFixed(2) : 0,
      globalNegRate: region.global ? +(glNeg / region.global).toFixed(2) : 0,
    },
    byPlatform,
    competitors: compAspectMatrix(days),
    aspectTrend: ASPECTS.map(a => {
      const cur = ebhi.per[a.key].score, prev = prevEbhi.per[a.key].score;
      return { key: a.key, name: a.name, score: cur, delta: cur - prev };
    }),
  };
}

function aspectsView(days) {
  const ms = inWindow(selfMentions(), days);
  const ebhi = store.calcEBHI(ms, db.company.weights);
  const compAvg = {};
  const compMatrix = compAspectMatrix(days);
  for (const a of ASPECTS) {
    compAvg[a.key] = Math.round(compMatrix.reduce((x, c) => x + c.per[a.key], 0) / compMatrix.length);
  }
  // 每方面：趋势、关键词、代表原声（员工/候选人/媒体分轨）
  const detail = ASPECTS.map(a => {
    const list = ms.filter(m => m.aspects.some(x => x.key === a.key));
    const s = store.aspectScore(ms, a.key);
    // 近 4 周周度趋势
    const weekly = [];
    for (let w = 3; w >= 0; w--) {
      const ws = sinceDays((w + 1) * 7), we = sinceDays(w * 7);
      const wm = list.filter(m => m.time >= ws && m.time < we);
      weekly.push({ week: `W-${3 - w}`, score: wm.length ? store.aspectScore(wm, a.key).score : null, count: wm.length });
    }
    // 关键词
    const kwMap = {};
    for (const m of list) for (const w of m.text.replace(/[，。？！""''（）]/g, ' ').split(/\s+/)) if (w.length >= 2) kwMap[w] = (kwMap[w] || 0) + 1;
    const keywords = Object.entries(kwMap).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([text, w]) => ({ text, w }));
    // 各口吻代表原声
    const voices = {};
    for (const aud of ['员工', '候选人', '媒体']) {
      voices[aud] = list.filter(m => m.audience === aud && m.sentiment.polarity === 'neg')
        .sort((x, y) => y.influence - x.influence).slice(0, 3);
    }
    return { key: a.key, name: a.name, score: s.score, pos: s.pos, neg: s.neg, total: s.total, weekly, keywords, voices, compAvg: compAvg[a.key], deltaVsComp: s.score - compAvg[a.key] };
  });
  return { days, ebhi: ebhi.total, self: ASPECTS.map(a => ({ key: a.key, name: a.name, score: ebhi.per[a.key].score })), compAvg, detail };
}

function candidateView(days) {
  const ms = inWindow(selfMentions(), days).filter(m => m.audience === '候选人');
  const pos = ms.filter(m => m.sentiment.polarity === 'pos').length;
  const neg = ms.filter(m => m.sentiment.polarity === 'neg').length;
  // 避雷关键词（负面候选人口吻高频词）
  const kw = {};
  for (const m of ms.filter(x => x.sentiment.polarity === 'neg')) {
    if (/避雷|毁约|拒|劝退|加班|裁员|薪资|坑/.test(m.text)) {
      for (const w of RegExp.$1 ? [] : m.text.split(/[,，。？！\s]+/)) if (w.length >= 2) kw[w] = (kw[w] || 0) + 1;
    }
  }
  const avoidWords = Object.entries(kw).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([text, w]) => ({ text, w }));
  // 面试星级分布（模拟：从 mgmt 情感推导）
  const rate = Math.min(0.9, Math.max(0.1, pos / (ms.length || 1)));
  const stars = [1, 2, 3, 4, 5].map(s => {
    const center = rate * 4.4 + 0.6;
    const w = Math.max(0, 5 - Math.abs(s - center) * 1.8);
    return { stars: s, count: Math.round(w * 40 + 5) };
  });
  const quotes = ms.sort((a, b) => b.influence - a.influence).slice(0, 8);
  const offerHeat = store.dailySeries(ms, Math.min(days, 30));
  return { days, total: ms.length, posRate: +rate.toFixed(2), pos, neg, avoidWords, stars, quotes, offerHeat };
}

// AI 对策生成（模板化，PRD F-ACT-01：止血—修复—增值）
function genStrategies(input) {
  const aspectName = input.aspect ? (ASPECTS.find(a => a.key === input.aspect) || {}).name || '综合' : '综合';
  const topic = input.topic || aspectName;
  const base = [
    { layer: '止血', title: `24 小时内发布针对「${topic}」的官方事实说明`, aspect: input.aspect || 'mgmt', owner: 'PR', timebox: '24h', expect: '负面扩散速率 -40%，热搜风险解除', risk: '声明需法务预审，避免承认性表述' },
    { layer: '止血', title: '高互动负面帖评论区官方回复 + 置顶澄清', aspect: input.aspect || 'mgmt', owner: 'PR', timebox: '48h', expect: '原帖评论区正面占比回升至 40%+', risk: '回复口径需与内部沟通要点一致' },
    { layer: '修复', title: `${aspectName}相关问题专项治理小组（HR 牵头）`, aspect: input.aspect || 'mgmt', owner: 'HR', timebox: '2 周', expect: '相关方面情感指数 30 天 +8 分', risk: '需业务负责人配合排期' },
    { layer: '修复', title: '内部沟通先行：员工 FAQ 与高管问答下发', aspect: 'mgmt', owner: 'HR', timebox: '1 周', expect: '员工口吻负面占比 -15%', risk: '内容与外部声明时序需协调' },
    { layer: '增值', title: '将该方面改进包装为雇主品牌传播点（员工故事/透明化数据）', aspect: input.aspect || 'growth', owner: '雇主品牌', timebox: '1 个月', expect: '正面声量份额 +5pp；候选人转化提升', risk: '需真实改进落地后再传播，避免反噬' },
  ];
  return base;
}

// 报告生成（PRD F-RPT-06）
function generateReport(opt) {
  const days = opt.days || 30;
  const ov = overview(days), asp = aspectsView(days);
  const prevOv = (() => {
    const ms = selfMentions().filter(m => m.time >= sinceDays(days * 2) && m.time < sinceDays(days));
    return store.calcEBHI(ms, db.company.weights).total;
  })();
  const worst = [...asp.detail].sort((a, b) => a.deltaVsComp - b.deltaVsComp)[0];
  const best = [...asp.detail].sort((a, b) => b.deltaVsComp - a.deltaVsComp)[0];
  const topTopic = ov.topics[0];
  const report = {
    id: 'r' + Date.now().toString(36),
    type: opt.type || '月度深度报告',
    days,
    topic: topTopic.topic,
    createdAt: Date.now(),
    range: [new Date(sinceDays(days)).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)],
    aiGenerated: true,
    sections: [
      { title: '一、总体健康度', conclusion: `本期 EBHI 为 ${ov.ebhi.total} 分（环比 ${ov.ebhi.delta >= 0 ? '+' : ''}${ov.ebhi.delta}），NSR ${ov.volume.nsr}，声量 ${ov.volume.total} 条。${ov.ebhi.delta < 0 ? '整体口碑承压，主因是「' + topTopic.topic + '」话题负面发酵。' : '整体口碑稳中有升。'}`, metrics: { ebhi: ov.ebhi.total, prevEbhi: prevOv, nsr: ov.volume.nsr, volume: ov.volume.total, sov: ov.sov } },
      { title: '二、方面拆解', conclusion: `「${worst.name}」为最大短板（低于竞品均值 ${Math.abs(worst.deltaVsComp)} 分，负面 ${worst.neg} 条）；「${best.name}」为相对优势（高于竞品均值 ${best.deltaVsComp} 分），建议作为传播抓手。`, detail: asp.detail.map(d => ({ name: d.name, score: d.score, compAvg: d.compAvg, pos: d.pos, neg: d.neg })) },
      { title: '三、竞品对标', conclusion: `竞品 EBHI 排序：${ov.competitors.map(c => `${c.name} ${c.ebhi}`).join('、')}。我方在「${worst.name}」与竞品差距最大，需优先补齐。`, competitors: ov.competitors },
      { title: '四、根因分析（AI 假设树）', conclusion: `「${topTopic.topic}」话题声量 ${topTopic.count} 条、负面率 ${Math.round(topTopic.negRate * 100)}%，根因假设：现象（负面集中在${worst.name}）→ 可能原因（政策沟通不透明 / 一线执行变形）→ 影响人群（在职员工 + 潜在候选人）。`, evidence: selfMentions().filter(m => m.topic === topTopic.topic && m.sentiment.polarity === 'neg').slice(0, 5).map(m => m.id) },
      { title: '五、下期建议', conclusion: `建议围绕「${worst.name}」启动止血—修复—增值三层行动，并可一键生成行动计划（见行动看板）。` },
    ],
  };
  db.reports.unshift(report);
  store.audit('当前用户', `生成${report.type}（${report.range[0]} ~ ${report.range[1]}）`);
  store.save();
  return report;
}

// ---------- API 路由 ----------
const apiRoutes = [];
function route(method, pattern, handler) { apiRoutes.push({ method, pattern, handler }); }

route('GET', /^\/api\/company$/, (req, res) => json(res, 200, db.company));
route('PUT', /^\/api\/company$/, async (req, res) => {
  const body = await readBody(req);
  db.company = { ...db.company, ...body, configured: true, configuredAt: Date.now() };
  store.audit('当前用户', '更新企业背景配置');
  store.save();
  json(res, 200, db.company);
});
route('POST', /^\/api\/company\/keywords\/preview$/, async (req, res) => {
  const body = await readBody(req);
  // 关键词试跑（F-CFG-01）：返回最近 7 天样本量估计
  const must = (body.must || []).length || 3;
  const sample = Math.round(320 + must * 130 + Math.random() * 60);
  await new Promise(r => setTimeout(r, 600));
  json(res, 200, { days: 7, estimatedPerDay: sample, irrelevantRate: +(0.05 + Math.random() * 0.05).toFixed(2), advice: sample > 500 ? '样本量充足，关键词组可启用' : '建议补充品牌别名/产品线词以提高召回' });
});

route('GET', /^\/api\/dashboard\/overview$/, (req, res, params, q) => json(res, 200, overview(parseInt(q.get('days')) || 30)));
route('GET', /^\/api\/dashboard\/aspects$/, (req, res, params, q) => json(res, 200, aspectsView(parseInt(q.get('days')) || 30)));
route('GET', /^\/api\/dashboard\/candidate$/, (req, res, params, q) => json(res, 200, candidateView(parseInt(q.get('days')) || 30)));

route('GET', /^\/api\/mentions$/, (req, res, params, q) => {
  const days = parseInt(q.get('days')) || 30;
  let list = inWindow(selfMentions(), days);
  const aspect = q.get('aspect'); if (aspect) list = list.filter(m => m.aspects.some(a => a.key === aspect));
  const polarity = q.get('polarity'); if (polarity) list = list.filter(m => m.sentiment.polarity === polarity);
  const platform = q.get('platform'); if (platform) list = list.filter(m => m.platform === platform);
  const audience = q.get('audience'); if (audience) list = list.filter(m => m.audience === audience);
  const kw = q.get('q'); if (kw) list = list.filter(m => m.text.includes(kw));
  const page = parseInt(q.get('page')) || 1, pageSize = Math.min(parseInt(q.get('pageSize')) || 20, 100);
  json(res, 200, { total: list.length, page, pageSize, items: list.slice((page - 1) * pageSize, page * pageSize) });
});
route('PATCH', /^\/api\/mentions\/([\w]+)$/, async (req, res, params) => {
  const body = await readBody(req);
  const m = db.mentions.find(x => x.id === params[1]);
  if (!m) return json(res, 404, { error: 'not found' });
  if (body.evidence !== undefined) m.flags.evidence = !!body.evidence;
  if (body.misjudge !== undefined) { m.flags.misjudge = !!body.misjudge; if (body.misjudge) store.audit('当前用户', `标记误判 ${m.id}（回流训练集）`); }
  store.save();
  json(res, 200, m);
});

route('GET', /^\/api\/alerts$/, (req, res) => json(res, 200, db.alerts));
route('GET', /^\/api\/events$/, (req, res) => json(res, 200, db.events));
route('POST', /^\/api\/alerts\/([\w]+)\/ack$/, async (req, res, params) => {
  const a = db.alerts.find(x => x.id === params[1]);
  if (!a) return json(res, 404, { error: 'not found' });
  a.ackBy = '当前用户（' + (db.company.shortName || 'EB') + '）'; a.ackAt = Date.now();
  store.audit(a.ackBy, `确认预警 ${a.id}：${a.title}`);
  store.save();
  json(res, 200, a);
});
route('POST', /^\/api\/strategies$/, async (req, res) => {
  const body = await readBody(req);
  json(res, 200, { input: body, generatedAt: Date.now(), strategies: genStrategies(body) });
});

route('GET', /^\/api\/actions$/, (req, res) => json(res, 200, db.actions));
route('POST', /^\/api\/actions$/, async (req, res) => {
  const body = await readBody(req);
  const item = {
    id: 't' + Date.now().toString(36), title: body.title || '未命名任务',
    aspect: body.aspect || null, layer: body.layer || '修复', owner: body.owner || '待分派',
    role: body.role || 'HR', due: body.due || Date.now() + 7 * DAY, status: 'todo',
    acceptance: body.acceptance || '', linked: body.linked || null, createdAt: Date.now(),
  };
  db.actions.unshift(item);
  store.audit('当前用户', `新建行动任务：${item.title}`);
  store.save();
  json(res, 200, item);
});
route('PATCH', /^\/api\/actions\/([\w]+)$/, async (req, res, params) => {
  const body = await readBody(req);
  const item = db.actions.find(x => x.id === params[1]);
  if (!item) return json(res, 404, { error: 'not found' });
  Object.assign(item, body);
  store.save();
  json(res, 200, item);
});

route('GET', /^\/api\/reports$/, (req, res) => json(res, 200, db.reports));
route('POST', /^\/api\/reports\/generate$/, async (req, res) => {
  const body = await readBody(req);
  const report = generateReport(body);
  json(res, 200, report);
});

route('GET', /^\/api\/audit$/, (req, res) => json(res, 200, db.auditLog.slice(0, 50)));

// ---------- 静态资源 ----------
function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(u.pathname);
  if (pathname.startsWith('/api/')) {
    for (const r of apiRoutes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.pattern);
      if (m) {
        try { return await r.handler(req, res, m, u.searchParams); }
        catch (e) { console.error(e); return json(res, 500, { error: String(e) }); }
      }
    }
    return json(res, 404, { error: 'api not found' });
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`[EB-Listening] 雇主品牌社交媒体倾听平台运行于 http://localhost:${PORT}`);
});
