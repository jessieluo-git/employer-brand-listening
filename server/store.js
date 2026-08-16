// store.js — 数据层：JSON 持久化 + 种子数据生成 + 指标计算（EBHI/NSR/SOV）
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---------- 基础常量（与 PRD 第 5/8 章一致） ----------
const ASPECTS = [
  { key: 'pay',      name: '薪酬福利' },
  { key: 'mgmt',     name: '管理与文化' },
  { key: 'workload', name: '工作强度与平衡' },
  { key: 'growth',   name: '职业发展' },
  { key: 'env',      name: '办公环境' },
  { key: 'org',      name: '组织变动' },
];
const PLATFORMS = [
  { key: 'maimai',   name: '脉脉',       region: 'cn', priority: 'P0' },
  { key: 'kanzhun',  name: '看准网',     region: 'cn', priority: 'P0' },
  { key: 'boss',     name: 'BOSS直聘',   region: 'cn', priority: 'P0' },
  { key: 'zhihu',    name: '知乎',       region: 'cn', priority: 'P0' },
  { key: 'weibo',    name: '微博',       region: 'cn', priority: 'P0' },
  { key: 'xhs',      name: '小红书',     region: 'cn', priority: 'P0' },
  { key: 'bili',     name: 'B站',        region: 'cn', priority: 'P1' },
  { key: 'tieba',    name: '贴吧',       region: 'cn', priority: 'P1' },
  { key: 'douban',   name: '豆瓣小组',   region: 'cn', priority: 'P1' },
  { key: 'glassdoor',name: 'Glassdoor',  region: 'global', priority: 'P0' },
  { key: 'indeed',   name: 'Indeed',     region: 'global', priority: 'P1' },
  { key: 'blind',    name: 'Blind',      region: 'global', priority: 'P1' },
  { key: 'reddit',   name: 'Reddit',     region: 'global', priority: 'P0' },
  { key: 'twitter',  name: 'X/Twitter',  region: 'global', priority: 'P1' },
  { key: 'linkedin', name: 'LinkedIn',   region: 'global', priority: 'P1' },
  { key: 'news',     name: '新闻/博客',  region: 'global', priority: 'P0' },
];
const TOPICS = [
  '版本冲刺加班', '项目奖金', '项目组优化传闻', '校招offer', '游戏行业寒冬', '版号',
  '出海项目', '面试体验', '制作人风格', '晋升答辩', '年终奖', '办公环境',
];
const AUDIENCES = ['员工', '候选人', '媒体'];

// 方面 × 极性 的中文语料模板（三七互娱·游戏行业语境，脱敏、含网络用语/反讽样本）
const TEXT_TPL = {
  pay: {
    neg: ['项目奖金说好上线后发，结果以“大盘调整”砍了大半', '策划岗薪资比大厂低一截，全靠年终奖撑门面', '画饼说项目跟投分红，三年了一点没兑现', '临入职两周被毁约，秋招黄金期全耽误了', '秋招避雷帖：offer 里承诺的年终，入职才知道打对折'],
    pos: ['爆款项目奖金是真的香，上线项目的同学直接欧洲游', '薪酬带宽透明，策划/美术/测试一岗一档', '公积金足额+补充医疗覆盖家属，这块厚道', '版本上线项目组人人有奖金，兑现不画饼'],
    neu: ['薪酬结构挺复杂，基本工资+绩效+项目奖金各占一部分', '想了解下贵司策划岗的薪资带宽大概什么范围？'],
  },
  mgmt: {
    neg: ['中台和项目组权责混乱，一个需求三边拍板', '管理层对项目方向朝令夕改，一个版本推翻三次', '匿名吐槽通道形同虚设，提了也白提'],
    pos: ['制作人真护项目，向上争取资源不含糊', '双周复盘会高管直接对一线问题，不回避', '结果导向，看产出不看工时'],
    neu: ['想问问贵司是项目制还是中台制？', '不同工作室管理风格差异大吗？'],
  },
  workload: {
    neg: ['版本冲刺连着一个月 9116，上线后调休根本批不下来', '上线前通宵改需求，第二天照常打卡', '大小周没了，但“自愿奋斗协议”又来了', '策划案改到凌晨，测试同学陪跑到天亮', '项目被砍=毕业，强度大到“被毕业”反而是解脱'],
    pos: ['版本间歇期挺人性化，准时下班没人给白眼', '上线后强制调休三天，领导还会赶人休假', '新制作人上任砍掉了一半无效站会和日报'],
    neu: ['想了解下贵司版本冲刺期的加班频率怎么样？', '强度看项目，头部项目和孵化线差别大'],
  },
  growth: {
    neg: ['晋升看项目存活，项目被砍团队原地解散', '做了三年数值策划还在填表，成长停滞', '内部转岗比跳槽还难，流程走半年'],
    pos: ['导师制+双通道（专家/管理），晋升窗口一年两次', '内部培训覆盖策划案方法论，考证还能报销', '校招三年带核心系统，成长曲线陡'],
    neu: ['请问校招生多久能独立负责系统设计？', '策划转制作人有内部通道吗？'],
  },
  env: {
    neg: ['工位挤，测试机申请要走三天流程', '美术同学设备是顶配，策划连个双屏都要等半个月'],
    pos: ['新办公楼环境一流，健身房下午茶都有', '双屏+顶配机是美术标配，设备申请自由', '广州总部园区食堂好吃不贵，下午茶管够'],
    neu: ['问下贵司是全部坐班还是支持混合办公？', '广州总部和异地工作室环境差别大吗？'],
  },
  org: {
    neg: ['又传项目组优化，脉脉B站都在聊，内网人心惶惶', '项目被砍整个组“毕业”，招聘却还在进行', '组织架构三个月一调，汇报线都理不清'],
    pos: ['砍掉的是重复建设的项目，核心项目还在扩编', '海外发行团队整合很平稳，没出现动荡'],
    neu: ['听说贵司在收缩非核心项目，会影响校招offer吗？', '哪些工作室是重点投入方向？'],
  },
};

// ---------- 伪随机（确定性，保证每次演示一致） ----------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260815);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function hashAuthor() {
  return 'u' + Math.floor(rnd() * 1e10).toString(36).padStart(7, '0');
}

// ---------- 种子数据生成（90 天故事线） ----------
function genMentions(company) {
  const mentions = [];
  const now = Date.now();
  const DAY = 86400000;
  let id = 1;
  // 方面基线情感概率（正面概率）
  const basePos = { pay: 0.32, mgmt: 0.38, workload: 0.30, growth: 0.45, env: 0.50, org: 0.28 };
  // 各平台声量权重（中国为主）
  const platWeight = { maimai: 14, kanzhun: 10, boss: 8, zhihu: 10, weibo: 12, xhs: 13, bili: 4, tieba: 3, douban: 3, glassdoor: 7, indeed: 3, blind: 4, reddit: 5, twitter: 4, linkedin: 3, news: 5 };
  const platKeys = Object.keys(platWeight);
  const totalWeight = Object.values(platWeight).reduce((a, b) => a + b, 0);

  for (let d = 89; d >= 0; d--) {
    const daysAgo = d;
    // 日声量基线 45±，随时间轻微增长；最近 10 天“版本冲刺加班”话题爆发 ×1.9
    let dayVol = 40 + Math.floor(rnd() * 14) + Math.floor((89 - d) * 0.12);
    const workloadSpike = daysAgo <= 9;
    const orgRumor = daysAgo >= 20 && daysAgo <= 26; // 项目组优化传闻事件窗
    if (workloadSpike) dayVol = Math.round(dayVol * 1.75);
    if (orgRumor) dayVol = Math.round(dayVol * 1.4);

    for (let i = 0; i < dayVol; i++) {
      // 按权重选平台
      let r = rnd() * totalWeight, platKey = platKeys[0];
      for (const k of platKeys) { r -= platWeight[k]; if (r <= 0) { platKey = k; break; } }
      const plat = PLATFORMS.find(p => p.key === platKey);
      // 主方面分布：近期偏向 workload，事件窗偏向 org
      let aspectKey = pick(ASPECTS).key;
      if (workloadSpike && rnd() < 0.42) aspectKey = 'workload';
      if (orgRumor && rnd() < 0.35) aspectKey = 'org';
      // 情感概率（故事线修正）
      let posP = basePos[aspectKey];
      if (workloadSpike && aspectKey === 'workload') posP = 0.12; // 突发负面
      if (orgRumor && aspectKey === 'org') posP = 0.10;
      if (daysAgo > 45) posP += 0.06; // 早期口碑略好
      const polarity = rnd() < posP ? 'pos' : (rnd() < 0.62 ? 'neg' : 'neu');
      // 副方面（一条内容可命中多方面，PRD F-SA-02）
      const aspects = [{ key: aspectKey, polarity }];
      if (rnd() < 0.22) {
        const second = pick(ASPECTS.filter(a => a.key !== aspectKey)).key;
        aspects.push({ key: second, polarity: rnd() < basePos[second] ? 'pos' : 'neg' });
      }
      const intensity = polarity === 'neu' ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 4);
      const audience = platKey === 'boss' || platKey === 'kanzhun' ? (rnd() < 0.7 ? '候选人' : '员工')
        : platKey === 'news' ? '媒体' : pick(AUDIENCES);
      const influence = Math.min(100, Math.floor(rnd() * 40) + (rnd() < 0.06 ? 60 + Math.floor(rnd() * 40) : 0));
      const topic = workloadSpike && aspectKey === 'workload' ? '版本冲刺加班'
        : orgRumor && aspectKey === 'org' ? '项目组优化传闻' : pick(TOPICS);
      const likes = Math.floor(rnd() * (influence > 50 ? 800 : 60));
      const time = now - daysAgo * DAY - Math.floor(rnd() * DAY);
      mentions.push({
        id: 'm' + id++,
        company: 'self',
        platform: plat.key,
        region: plat.region,
        authorHash: hashAuthor(),
        time,
        lang: plat.region === 'cn' ? 'zh' : 'en',
        text: pick(TEXT_TPL[aspectKey][polarity]),
        likes, reposts: Math.floor(likes * 0.15), comments: Math.floor(likes * 0.3),
        sentiment: { polarity, intensity },
        aspects,
        topic, audience, influence,
        flags: { evidence: false, misjudge: false },
      });
    }
  }
  mentions.sort((a, b) => b.time - a.time);
  return mentions;
}

// 竞品声量（只存日聚合，用于对比曲线与 SOV）
function genCompetitors() {
  const defs = [
    { key: 'c1', name: '网易游戏', ebhiBias: +6 },
    { key: 'c2', name: '吉比特', ebhiBias: +2 },
    { key: 'c3', name: '巨人网络', ebhiBias: -2 },
    { key: 'c4', name: '完美世界', ebhiBias: -5 },
  ];
  return defs.map(d => ({ ...d, enabled: true }));
}

// 竞品每日方面情感聚合（模拟，用于雷达/热力图/EBHI 对比）
function genCompDaily(comps) {
  const out = [];
  const basePos = { pay: 0.32, mgmt: 0.38, workload: 0.30, growth: 0.45, env: 0.50, org: 0.28 };
  for (const c of comps) {
    for (let d = 89; d >= 0; d--) {
      for (const a of ASPECTS) {
        // 竞品口碑整体随 ebhiBias 平移，workload 事件对竞品是正面（对比效应）
        let posP = Math.min(0.85, Math.max(0.05, basePos[a.key] + c.ebhiBias / 100 + (rnd() - 0.5) * 0.08));
        if (a.key === 'workload' && d <= 9) posP += 0.10;
        const pos = Math.round(8 + rnd() * 14 + posP * 20);
        const neg = Math.round(6 + rnd() * 12 + (1 - posP) * 18);
        const neu = Math.round(4 + rnd() * 8);
        out.push({ comp: c.key, daysAgo: d, aspect: a.key, pos, neg, neu });
      }
    }
  }
  return out;
}

// 预警种子（PRD F-ALR 01/02/03）
function genAlerts(mentions) {
  const now = Date.now();
  const HOUR = 3600000;
  return [
    {
      id: 'a1', level: 'red', status: 'active',
      rule: '负面声量突增', title: '「版本冲刺加班」负面声量 1 小时内达日均值 3.4 倍',
      aspect: 'workload', metric: '负面量 47 条/小时（日均值 14 条/小时）',
      triggeredAt: now - 26 * HOUR, ackBy: null, ackAt: null,
      eventId: 'e1',
      evidence: mentions.filter(m => m.topic === '版本冲刺加班' && m.sentiment.polarity === 'neg').slice(0, 5).map(m => m.id),
    },
    {
      id: 'a2', level: 'yellow', status: 'active',
      rule: '评分骤降', title: 'Glassdoor 公司评分 7 日内 3.9 → 3.4（-0.5）',
      aspect: 'mgmt', metric: '评分变化 -0.5，游戏行业均值 3.7',
      triggeredAt: now - 3 * 24 * HOUR, ackBy: null, ackAt: null, eventId: null,
      evidence: [],
    },
    {
      id: 'a3', level: 'blue', status: 'active',
      rule: 'KOL 正面内容', title: '游戏职场 KOL「游戏人观察」（粉丝 65 万）发布正面办公环境测评',
      aspect: 'env', metric: '影响力分 88，互动 9 千',
      triggeredAt: now - 8 * HOUR, ackBy: null, ackAt: null, eventId: null,
      evidence: [],
    },
    {
      id: 'a4', level: 'red', status: 'resolved',
      rule: '特定关键词命中', title: '「裁员/项目优化」关键词 48h 命中 216 次（事件：项目组优化传闻）',
      aspect: 'org', metric: '峰值时段 22 条/小时',
      triggeredAt: now - 24 * 24 * HOUR, ackBy: '张主任(PR)', ackAt: now - 23 * 24 * HOUR, eventId: 'e2',
      evidence: [],
    },
  ];
}

// 事件档案（时间线）
function genEvents(now) {
  const HOUR = 3600000;
  return [
    {
      id: 'e1', title: '「版本冲刺加班」负面舆情发酵中', status: 'ongoing', alertId: 'a1',
      timeline: [
        { t: now - 38 * HOUR, label: '首发现帖', desc: '脉脉职言区“版本冲刺连着一个月 9116”帖，互动 3.2k' },
        { t: now - 30 * HOUR, label: '扩散节点', desc: '转载至微博职场话题 + 小红书“游戏公司避雷帖”，互动过万' },
        { t: now - 26 * HOUR, label: '触发红色预警', desc: '负面声量突增规则命中，推送 PR/HRVP' },
        { t: now - 20 * HOUR, label: '参与平台扩散', desc: '知乎出现“三七互娱工作强度如何”追问帖；B站职场区二创视频上线' },
      ],
      platforms: ['脉脉', '微博', '小红书', '知乎', 'B站'],
      handling: ['已暂停“自愿奋斗协议”内网公告（HR，T-1d）'],
    },
    {
      id: 'e2', title: '项目组优化传闻事件（已平息）', status: 'closed', alertId: 'a4',
      timeline: [
        { t: now - 26 * 24 * HOUR, label: '首发现帖', desc: '匿名爆料称某孵化项目组整体优化 15%' },
        { t: now - 25 * 24 * HOUR, label: '扩散峰值', desc: '48h 内 216 次关键词命中，知乎热榜第 18 位' },
        { t: now - 24 * 24 * HOUR, label: '触发红色预警并确认', desc: 'PR 负责人 12 分钟确认回执' },
        { t: now - 23 * 24 * HOUR, label: '官方回应', desc: '声明口径发布 + 高管 QA 下发（聚焦核心项目扩编事实）' },
        { t: now - 20 * 24 * HOUR, label: '平息', desc: '声量回落至基线，情感指数回升' },
      ],
      platforms: ['脉脉', '知乎', '微博'],
      handling: ['官方声明发布（PR）', '内部沟通要点下发（HR）', '高管 QA 口径同步'],
    },
  ];
}

// 行动看板种子（PRD F-ACT-02）
function genActions(now) {
  const DAY = 86400000;
  return [
    { id: 't1', title: '发布《版本冲刺保障说明》（调休+打车+餐补）', aspect: 'workload', layer: '止血', owner: 'HR·王莉', role: 'HR', due: now + 3 * DAY, status: 'todo', acceptance: '官方说明触达 ≥ 50w 曝光；原帖下官方回复点赞 ≥ 500', linked: 'a1', createdAt: now - 2 * DAY },
    { id: 't2', title: '冲刺调休与项目奖金兑现流程专项治理（3 层审批 → 1 层）', aspect: 'workload', layer: '修复', owner: 'HR·李强', role: 'HR', due: now + 14 * DAY, status: 'doing', progress: 45, acceptance: '调休审批时长 P90 ≤ 4 小时；项目奖金按期兑付率 100%', linked: 'a1', createdAt: now - 8 * DAY },
    { id: 't3', title: '校招 offer 话术更新：策划/美术岗薪酬带宽透明说明页', aspect: 'pay', layer: '增值', owner: 'TA·陈敏', role: 'TA', due: now + 21 * DAY, status: 'todo', acceptance: 'offer 接受率环比 +3pp；秋招毁约类帖文 -30%', linked: null, createdAt: now - 1 * DAY },
    { id: 't4', title: '项目组优化传闻事件复盘报告归档', aspect: 'org', layer: '修复', owner: 'PR·张主任', role: 'PR', due: now - 2 * DAY, status: 'done', progress: 100, acceptance: '复盘会完成；危机 SOP 模板更新', linked: 'e2', createdAt: now - 20 * DAY, effect: { before: 41, after: 55, days: 30, verdict: '相关方面情感指数 30 天内 +14 分，行动判定：有效' } },
    { id: 't5', title: 'Glassdoor / 拉勾雇主主页资料更新（雇主品牌物料 2.0）', aspect: 'mgmt', layer: '增值', owner: 'EB·周航', role: '雇主品牌', due: now + 10 * DAY, status: 'doing', progress: 70, acceptance: '资料完整度 100%；评分页回复率 ≥ 80%', linked: 'a2', createdAt: now - 5 * DAY },
    { id: 't6', title: '项目跟投/分红规则 FAQ 上线', aspect: 'pay', layer: '修复', owner: 'HR·王莉', role: 'HR', due: now - 6 * DAY, status: 'parked', parkReason: '等法务与证券部口径确认后重启', linked: null, createdAt: now - 15 * DAY },
  ];
}

// ---------- 指标计算（PRD 第 8 章） ----------
function aspectScore(list, aspectKey) {
  let pos = 0, neg = 0, neu = 0;
  for (const m of list) {
    const hit = m.aspects.find(a => a.key === aspectKey);
    if (!hit) continue;
    if (hit.polarity === 'pos') pos++; else if (hit.polarity === 'neg') neg++; else neu++;
  }
  const total = pos + neg + neu;
  if (!total) return { score: 50, pos, neg, neu, total: 0 };
  const ratio = (pos - neg) / total; // -1..1
  return { score: Math.round(50 + ratio * 50), pos, neg, neu, total };
}

function calcEBHI(mentions, weights) {
  const per = {};
  let weighted = 0, wsum = 0;
  for (const a of ASPECTS) {
    const w = (weights && weights[a.key]) || 1;
    const s = aspectScore(mentions, a.key);
    per[a.key] = s;
    weighted += s.score * w; wsum += w;
  }
  const raw = weighted / wsum;
  const platformCoverage = 0.96; // 平台覆盖修正（16/16 平台在采）
  const influenceAdj = 0.98;     // 影响力修正（高影响力负面降权后）
  return { total: Math.round(raw * platformCoverage * influenceAdj), per, corrections: { platformCoverage, influenceAdj } };
}

function dailySeries(mentions, days) {
  const now = new Date(); now.setHours(23, 59, 59, 999);
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const end = now.getTime() - d * 86400000;
    const start = end - 86400000;
    const dayM = mentions.filter(m => m.time > start && m.time <= end);
    const pos = dayM.filter(m => m.sentiment.polarity === 'pos').length;
    const neg = dayM.filter(m => m.sentiment.polarity === 'neg').length;
    const neu = dayM.length - pos - neg;
    out.push({
      date: new Date(end).toISOString().slice(0, 10),
      total: dayM.length, pos, neg, neu,
      nsr: dayM.length ? +(((pos - neg) / dayM.length).toFixed(3)) : 0,
    });
  }
  return out;
}

// ---------- DB ----------
function defaultCompany() {
  return {
    configured: true, // 种子已配置；向导可重新设置
    name: '三七互娱', shortName: '三七互娱', enName: '37 Interactive Entertainment',
    aliases: ['顺荣股份（上市主体曾用名）', '37游戏（品牌曾用名）'],
    industry: '网络游戏 / 数字文娱', size: '5000+ 人', hq: '广州',
    execs: [{ name: '李逸飞', title: '董事长·联合创始人' }],
    subsidiaries: ['37网游', '37手游', '37 Games（海外发行）'],
    brands: ['叫我大掌柜', '寻道大千', '斗罗大陆：魂师对决', 'Puzzle & Survival', '小小蚁族'],
    keywords: {
      must: ['三七互娱', '37互娱', '三七娱乐', '37 Interactive', '37游戏'],
      exclude: ['三七（中药材）', '三七片', '田七'], // 同名消歧：避免与中药材“三七”误关联
    },
    aspects: ASPECTS.map(a => ({ ...a, enabled: true })),
    competitors: genCompetitors(),
    weights: { pay: 1, mgmt: 1, workload: 1.2, growth: 1, env: 0.8, org: 1 },
    languages: ['zh-CN', 'zh-TW', 'en'],
    regionWeights: { cn: 0.6, global: 0.4 },
    crawlSchedule: PLATFORMS.reduce((acc, p) => { acc[p.key] = p.priority === 'P0' ? 'hourly' : 'daily'; return acc; }, {}),
    configuredAt: Date.now() - 90 * 86400000,
  };
}

let db = null;
function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } else {
    const company = defaultCompany();
    const mentions = genMentions(company);
    db = {
      company,
      mentions,
      compDaily: genCompDaily(company.competitors),
      alerts: genAlerts(mentions),
      events: genEvents(Date.now()),
      actions: genActions(Date.now()),
      reports: [],
      auditLog: [{ t: Date.now(), actor: '系统', action: '初始化种子数据（回溯 90 天）' }],
    };
    save();
  }
  return db;
}
function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf-8');
}
function audit(actor, action) {
  db.auditLog.unshift({ t: Date.now(), actor, action });
  db.auditLog = db.auditLog.slice(0, 200);
}

module.exports = {
  ASPECTS, PLATFORMS, TOPICS,
  load, save, audit,
  calcEBHI, aspectScore, dailySeries,
};
