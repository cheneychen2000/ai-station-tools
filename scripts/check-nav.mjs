/**
 * 全站导航 / 模型库体验 / 比较器一致性 / 陈旧文案 专项检查：
 *  - N1~N4：每个 HTML 页（含 404）都有统一主导航、跳到正文链接、正确 active/aria-current、导航目标无死链
 *  - N5：页脚站内导航区（核心工具/关于本站/GitHub 反馈）
 *  - N6：无旧品牌字符串与过时的硬编码模型/组合数量
 *  - N7：数量文案与构建时真实数据一致（首页/工具库/比较器）
 *  - N8：模型库搜索/筛选/排序工具栏与卡片数据属性完整，价格排序键为人民币折算值而非原币种数字
 *  - N9：选择器清单（compare-pairs.json）与生成器策略一致，详情页可预选带入比较器
 * 运行：node scripts/check-nav.mjs（在 build 之后执行）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, comparePairs } from './lib/manifest.mjs';
import { monthlyBase, monthly, modelCurrency } from './lib/pricing.mjs';
import { adSlotHtml } from './lib/ads.mjs';

const R = createReporter('check-nav');
const { models, fx, compares } = loadData();
const N = models.length;
const PAIRS = comparePairs(models, compares.extraPairs || []);
const PAIR_COUNT = PAIRS.length;

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const pages = walk(DIST);
const read = rel => readFileSync(join(DIST, rel), 'utf8');

/** 路径 → 期望的导航 active key */
function expectedActive(rel) {
  if (rel === 'index.html') return 'home';
  if (rel.startsWith('cost/')) return 'cost';
  if (rel.startsWith('guides/')) return 'guides';
  if (rel.startsWith('models/')) return 'models';
  if (rel.startsWith('compare/')) return 'compare';
  if (rel.startsWith('tools/')) return 'tools';
  if (rel.startsWith('prompts/')) return 'prompts';
  if (rel === 'en/index.html') return 'en-home';
  if (rel.startsWith('en/cost/')) return 'en-cost';
  if (rel.startsWith('en/models/')) return 'en-model';
  return null; /* 英文导航仅 Home/Cost/Model Library 三项，其余页与中文 quiz 页同策略不设 active */
}

const NAV_LABELS = ['成本计算器', '模型库', '模型对比', '开发指南', 'AI 工具目录', 'Prompt 资源', 'English'];
/* 英文站导航：仅链接真实存在的英文页，末项为语言切换器（目标由路由映射计算） */
const EN_NAV_LABELS = ['Home', 'Cost Calculator', 'Model Library', '中文'];
let navBad = [], linkBad = [], activeBad = [], skipBad = [], footerBad = [];

for (const file of pages) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const txt = readFileSync(file, 'utf8');
  const is404 = rel === '404.html';
  const isEn = rel.startsWith('en/');

  /* 跳到正文链接 + 正文锚点（英文页为英文等价文案） */
  const skipLink = isEn ? '<a class="skip-link" href="#main">Skip to content</a>' : '<a class="skip-link" href="#main">跳到正文</a>';
  if (!txt.includes(skipLink) || !txt.includes('id="main"')) skipBad.push(rel);

  /* 主导航：唯一、语义化、顺序与文案一致 */
  const navAria = isEn ? 'Main navigation' : '主导航';
  const navBlock = (txt.match(new RegExp(`<nav class="site-nav" aria-label="${navAria}">[\\s\\S]*?<\\/nav>`)) || [])[0];
  if (!navBlock) { navBad.push(`${rel}（缺主导航）`); continue; }
  const items = [...navBlock.matchAll(/<a\s[^>]*href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
  const expectLabels = isEn ? EN_NAV_LABELS : NAV_LABELS;
  if (items.map(m => m[3]).join('|') !== expectLabels.join('|')) navBad.push(`${rel}（导航项顺序/文案不符）`);

  /* 品牌链接始终回首页 */
  const brand = (txt.match(/<a class="brand" href="([^"]+)"[^>]*>/) || [])[1];
  if (!brand) navBad.push(`${rel}（品牌不是链接）`);
  else {
    const brandTarget = brand === '/' || brand === './' ? join(DIST, 'index.html') : resolve(dirname(file), brand, 'index.html');
    if (!existsSync(brandTarget)) linkBad.push(`${rel}（品牌链接死链 ${brand}）`);
  }

  /* active 与 aria-current */
  const expect = expectedActive(rel);
  const currents = items.filter(m => m[2].includes('aria-current="page"'));
  const activeKey = expect && expect !== 'home' && expect !== 'en-home' ? expect : null;
  if (activeKey) {
    const labelIdx = { cost: 0, models: 1, compare: 2, guides: 3, tools: 4, prompts: 5, 'en-cost': 1, 'en-model': 2, 'en-compare': 2, 'en-guides': 3, 'en-tools': 4, 'en-prompts': 5 }[activeKey];
    const target = (isEn ? EN_NAV_LABELS : NAV_LABELS)[labelIdx];
    if (currents.length !== 1 || currents[0][3] !== target || !currents[0][2].includes('class="active"')) {
      activeBad.push(`${rel}（期望 ${target} 唯一 aria-current+active）`);
    }
  } else if (currents.length !== 0) activeBad.push(`${rel}（不应出现 aria-current）`);
  if ((expect === 'home' || expect === 'en-home') && !txt.includes('<a class="brand" href="./" aria-current="page">')) activeBad.push(`${rel}（首页品牌缺 aria-current）`);

  /* 导航目标 URL 全部存在 */
  for (const m of items) {
    const href = m[1];
    const target = href.startsWith('/') ? join(DIST, href, 'index.html') : resolve(dirname(file), href, 'index.html');
    if (!existsSync(target)) linkBad.push(`${rel}（导航死链 ${href}）`);
  }

  /* 页脚站内导航区（404 无页脚，豁免；英文页为英文等价结构） */
  if (!is404) {
    if (isEn) {
      if (!txt.includes('<nav class="footer-nav" aria-label="Footer navigation">') ||
          !txt.includes('Core tools:') ||
          !txt.includes('https://github.com/cheneychen2000/ai-station-tools/issues')) footerBad.push(rel);
    } else if (!txt.includes('<nav class="footer-nav" aria-label="页脚导航">') ||
        !txt.includes('核心工具：') || !txt.includes('GitHub 反馈') ||
        !txt.includes('https://github.com/cheneychen2000/ai-station-tools/issues')) footerBad.push(rel);
  }
}

R.check(`N1 全站 ${pages.length} 页统一主导航（顺序/文案/品牌链接）`, navBad.length === 0, navBad.join(' | ') || '全部一致');
R.check('N2 每页跳到正文链接与 #main 锚点齐全', skipBad.length === 0, skipBad.join(' | ') || '全部具备');
R.check('N3 active 状态与 aria-current 逐页正确（含首页品牌）', activeBad.length === 0, activeBad.join(' | ') || '全部正确');
R.check('N4 主导航与品牌链接无死链（含嵌套详情页与 404 根绝对路径）', linkBad.length === 0, linkBad.join(' | ') || '0 死链');
R.check('N5 页脚站内导航区齐全（核心工具/关于本站/GitHub 反馈）', footerBad.length === 0, footerBad.join(' | ') || '全部具备');

/* N6 陈旧字符串：旧品牌与过时硬编码数量（历史报告不在扫描范围） */
let stale = [];
for (const file of pages) {
  const txt = readFileSync(file, 'utf8');
  for (const s of ['AI七号驿站', 'AI驿站', '66 组', '12 款']) {
    if (txt.includes(s)) stale.push(`${relative(DIST, file)}（${s}）`);
  }
}
for (const asset of ['assets/style.css', 'assets/app.js', 'assets/quiz.js']) {
  const txt = read(asset);
  if (txt.includes('AI驿站') || txt.includes('AI七号驿站')) stale.push(asset);
}
R.check('N6 无旧品牌字符串与过时硬编码数量（66 组/12 款）', stale.length === 0, stale.join(' | ') || '零残留');

/* N7 数量文案 = 构建时真实数据 */
const home = read('index.html');
const toolsIdx = read('tools/index.html');
const compareIdx = read('compare/index.html');
const homePlain = home.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ''); /* 剥注入标记与空白后断言数量文案 */
R.check(`N7 首页对比卡片组合数 = ${PAIR_COUNT}`, homePlain.includes(`${PAIR_COUNT}组组合任选`));
R.check(`N7b 工具库自研卡片数量 = ${N} 款 / ${PAIR_COUNT} 组`,
  toolsIdx.includes(`${N} 款大模型 API 月成本比价`) && toolsIdx.includes(`${N} 款主流模型`) && toolsIdx.includes(`${PAIR_COUNT} 组组合`));
R.check(`N7c 比较器统计行 = 全部 ${PAIR_COUNT} 组（${N} 款两两全组合）`,
  compareIdx.includes(`全部 ${PAIR_COUNT} 组对比（${N} 款模型两两全组合）`));
R.check('N7d 比较器不再宣称"精选入口"旧策略', !compareIdx.includes('精选入口') && !compareIdx.includes('组精选对比'));

/* N8 模型库：工具栏 + 卡片数据属性 + 折算排序键 */
const modelsIdx = read('models/index.html');
R.check('N8 模型库搜索/厂商/币种/排序控件与无结果提示存在',
  modelsIdx.includes('id="libSearch"') && modelsIdx.includes('id="libVendor"') && modelsIdx.includes('id="libCur"') &&
  modelsIdx.includes('id="libSort"') && modelsIdx.includes('id="libEmpty"') && modelsIdx.includes('id="libClear"') &&
  modelsIdx.includes('aria-label="搜索模型名称、模型 ID 或厂商"'));
let cardBad = [];
for (const m of models) {
  const card = (modelsIdx.match(new RegExp(`<a class="module-card active" href="${m.id}/"[^>]*>`)) || [])[0];
  if (!card) { cardBad.push(`${m.id}（卡片缺失）`); continue; }
  const search = (card.match(/data-search="([^"]*)"/) || [])[1] || '';
  if (!search.includes(m.name.toLowerCase()) || !search.includes(m.id.toLowerCase()) || !search.includes(m.vendor.toLowerCase())) {
    cardBad.push(`${m.id}（搜索键缺名称/ID/厂商）`);
  }
  if (!card.includes(`data-cur="${modelCurrency(m)}"`)) cardBad.push(`${m.id}（币种属性错误）`);
  const expectCost = monthlyBase(m, fx);
  const gotCost = (card.match(/data-cost="([^"]*)"/) || [])[1];
  if (expectCost == null) {
    if (gotCost !== '') cardBad.push(`${m.id}（未核实价格应有空排序键）`);
  } else if (Math.abs(parseFloat(gotCost) - expectCost) > 0.001) {
    cardBad.push(`${m.id}（排序键 ${gotCost} ≠ 折算值 ${expectCost.toFixed(4)}）`);
  }
  if (!card.includes(`data-vendor="${m.vendor}"`) || !card.includes(`data-verified="${m.verifiedAt}"`)) cardBad.push(`${m.id}（厂商/核验日期属性缺失）`);
}
R.check(`N8b ${N} 张卡片搜索/筛选/排序数据属性全部正确`, cardBad.length === 0, cardBad.join(' | ') || '全部正确');
/* 排序键必须是折算值而非原币种数字：USD 模型的 data-cost 显著大于其美元月成本 */
const usdSample = models.find(m => modelCurrency(m) === 'USD');
const usdCard = modelsIdx.match(new RegExp(`<a class="module-card active" href="${usdSample.id}/"[^>]*>`))[0];
const usdCost = parseFloat(usdCard.match(/data-cost="([^"]*)"/)[1]);
R.check('N8c 价格排序键为人民币折算值（不存在不同币种原始数字直接排序）',
  usdCost > monthly(usdSample) && Math.abs(usdCost - monthlyBase(usdSample, fx)) < 0.001);
R.check('N8d 工具栏注明参考汇率日期与估算性质',
  modelsIdx.includes('中国外汇交易中心中间价') && modelsIdx.includes(fxEntryDate()) && modelsIdx.includes('折算仅供参考'));
function fxEntryDate() { return (fx.rates.USD_CNY || {}).rateDate || ''; }
R.check('N8e 无 JS 时静态卡片仍全部可见（卡片不依赖脚本渲染、无 fetch 渲染）',
  !/<a class="module-card[^>]*\shidden/.test(modelsIdx) && !/fetch\([^)]*models\.json/.test(modelsIdx) && models.every(m => modelsIdx.includes(`href="${m.id}/"`)));

/* N9 比较器：选择器清单与生成策略一致、详情页预选链接 */
const pairsJson = JSON.parse(read('assets/data/compare-pairs.json'));
R.check(`N9 compare-pairs.json = 生成器全组合清单（${PAIRS.length} 组，a<b 归一）`,
  pairsJson.pairs.length === PAIRS.length && pairsJson.pairs.every(([a, b], i) => a < b && a === PAIRS[i][0] && b === PAIRS[i][1]));
R.check('N9b 模型详情页含"带入比较器"预选链接', models.every(m => read(`models/${m.id}/index.html`).includes(`../../compare/?a=${m.id}`)));
R.check('N9c 模型详情页含成本计算器与模型库内链',
  models.every(m => {
    const t = read(`models/${m.id}/index.html`);
    return t.includes(`../../cost/?models=${m.id}`) && t.includes('>返回模型库</a>');
  }));
R.check('N9d 比较器选择器读取同一份 models.json 与 compare-pairs.json',
  compareIdx.includes("fetch('../assets/data/models.json')") && compareIdx.includes("fetch('../assets/data/compare-pairs.json')"));

/* N10 favicon：所有页面（含 404）含 4 条图标引用，且引用文件真实存在于发布根目录 */
const ICON_LINKS = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
];
let iconBad = [];
for (const file of pages) {
  const txt = readFileSync(file, 'utf8');
  for (const link of ICON_LINKS) {
    if (!txt.includes(link)) { iconBad.push(`${relative(DIST, file)}（缺 ${link}）`); break; }
  }
}
R.check(`N10 全站 ${pages.length} 页 favicon 引用齐全`, iconBad.length === 0, iconBad.join(' | ') || '全部具备');
R.check('N10b 图标文件全部存在于发布根目录（ico/16/32/180/192/512）',
  ['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/apple-touch-icon.png', '/favicon-192x192.png', '/favicon-512x512.png']
    .every(p => existsSync(join(DIST, p))));
/* N10c PWA：全站登记 manifest，且 manifest 本身合法（名称/起始页/显示模式/≥192 图标均存在） */
let manBad = [];
for (const file of pages) {
  if (!readFileSync(file, 'utf8').includes('<link rel="manifest" href="/manifest.json">')) manBad.push(relative(DIST, file));
}
R.check(`N10c 全站 ${pages.length} 页登记 PWA manifest`, manBad.length === 0, manBad.join(' | ') || '全部具备');
const manOk = (() => {
  try {
    const m = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
    return !!m.name && !!m.short_name && !!m.start_url && ['standalone', 'fullscreen', 'minimal-ui'].includes(m.display) &&
      Array.isArray(m.icons) && m.icons.length >= 2 &&
      m.icons.every(i => i.sizes && i.src && existsSync(join(DIST, i.src.replace(/^\//, '')))) &&
      m.icons.some(i => i.sizes.startsWith('192')) && m.icons.some(i => i.sizes.startsWith('512'));
  } catch { return false; }
})();
R.check('N10d manifest.json 合法（名称/start_url/standalone/192+512 图标文件存在）', manOk);

/* N11 信任页面（定价方法论/隐私政策/联盟披露/使用条款）：title/H1/canonical/可索引/导航/面包屑/sitemap/正文 */
const TRUST_PAGES = [
  { path: 'pricing-methodology/', name: '定价方法论', h1: '定价方法论' },
  { path: 'privacy/', name: '隐私政策', h1: '隐私政策' },
  { path: 'affiliate-disclosure/', name: '联盟推广披露', h1: '联盟推广披露' },
  { path: 'terms/', name: '使用条款', h1: '使用条款' }
];
const sitemapTxt = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
let trustBad = [];
for (const tp of TRUST_PAGES) {
  const rel = tp.path + 'index.html';
  if (!existsSync(join(DIST, rel))) { trustBad.push(`${rel}（文件缺失）`); continue; }
  const t = readFileSync(join(DIST, rel), 'utf8');
  if (!(new RegExp(`<title>[^<]*${tp.name}[^<]*\\| Reflex Hub</title>`)).test(t)) trustBad.push(`${rel}（title 不符）`);
  if (!t.includes(`<h1>${tp.h1}</h1>`)) trustBad.push(`${rel}（H1 缺失）`);
  if (!t.includes(`<link rel="canonical" href="https://www.reflex-hub.com/${tp.path}">`)) trustBad.push(`${rel}（canonical 非自引用）`);
  if (/noindex/.test(t)) trustBad.push(`${rel}（误带 noindex）`);
  if (!t.includes('<nav class="site-nav" aria-label="主导航">')) trustBad.push(`${rel}（缺主导航）`);
  if (!t.includes('跳到正文')) trustBad.push(`${rel}（缺跳到正文）`);
  if (!t.includes('<nav class="footer-nav" aria-label="页脚导航">')) trustBad.push(`${rel}（缺页脚导航）`);
  const ld = (t.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []).join('');
  if (!ld.includes('"@type": "BreadcrumbList"') || !ld.includes(tp.name)) trustBad.push(`${rel}（面包屑 JSON-LD 缺失）`);
  if (!sitemapTxt.includes(`https://www.reflex-hub.com/${tp.path}`)) trustBad.push(`${rel}（未进 sitemap）`);
  const body = t.split('<main')[1] || '';
  if (body.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length < 400) trustBad.push(`${rel}（正文过短）`);
}
R.check(`N11 ${TRUST_PAGES.length} 个信任页面元数据/导航/面包屑/sitemap/正文齐全`, trustBad.length === 0, trustBad.join(' | ') || '全部合规');
R.check('N11b 全站页脚含站点信息组（4 个新页面内链入口；英文页为"Chinese site"组）',
  pages.every(f => {
    if (f.endsWith('404.html')) return true;
    const t = readFileSync(f, 'utf8');
    return t.includes('站点信息：') || t.includes('Chinese site:');
  }));

/* N12 指南页（定价比较/场景案例）：存在、正文非空（含构建注入表）、内链、canonical、可索引、面包屑、sitemap */
const GUIDE_PAGES = [
  { path: 'guides/llm-api-cost/', h1: '如何计算 LLM API 成本', table: '输入有效单价', links: ['../../cost/', '../../models/', '../../compare/', '../../models/gpt-6-luna/'],
    must: ['上下文长度分档', '多币种', '缓存写入费', '未公开档位不补价', '价格核验时间'] },
  { path: 'guides/llm-api-pricing-comparison/', h1: '大模型 API 定价比较', table: '<th>估算月成本', links: ['../../cost/', '../../models/', '../../compare/'], must: [] },
  { path: 'guides/llm-api-cost-examples/', h1: '大模型 API 月度成本案例', table: '场景一：聊天机器人', links: ['../../cost/', '../llm-api-cost/', '../../models/'],
    must: ['敏感性', '命中率 0%', '示例假设', '无法估算'] },
  { path: 'guides/make-llm-workflow/', h1: '用 Make 搭建大模型 API 自动化工作流', table: '每 1,000 次运行', links: ['../../cost/', '../../models/', '../workflow-automation-choose/'],
    must: ['文档研究', '未做任何界面实测', '候选评估阶段', '不含任何推广链接', '未核验'] },
  { path: 'guides/workflow-automation-choose/', h1: 'Make、n8n 与自建 API：AI 工作流方案怎么选', table: '<th>维度</th>', links: ['../../cost/', '../make-llm-workflow/', '../../models/'],
    must: ['fair-code', '不预设任何产品获胜', '不含任何推广链接', 'credits', 'executions', '2026-10-28 核验', '两个单位不可互换'] }
];
let guideBad = [];
for (const gp of GUIDE_PAGES) {
  const rel = gp.path + 'index.html';
  const t = existsSync(join(DIST, rel)) ? readFileSync(join(DIST, rel), 'utf8') : '';
  if (!t) { guideBad.push(`${rel}（文件缺失）`); continue; }
  if (!t.includes(`<h1>${gp.h1}</h1>`)) guideBad.push(`${rel}（H1 缺失）`);
  if (!t.includes(`<link rel="canonical" href="https://www.reflex-hub.com/${gp.path}">`)) guideBad.push(`${rel}（canonical 非自引用）`);
  if (/noindex/.test(t)) guideBad.push(`${rel}（误带 noindex）`);
  if (!t.includes('<nav class="site-nav" aria-label="主导航">')) guideBad.push(`${rel}（缺主导航）`);
  if (!t.includes('BreadcrumbList')) guideBad.push(`${rel}（缺面包屑 JSON-LD）`);
  if (!t.includes(gp.table)) guideBad.push(`${rel}（数据表注入缺失）`);
  for (const m of gp.must) if (!t.includes(m)) guideBad.push(`${rel}（缺必需内容：${m}）`);
  for (const l of gp.links) if (!t.includes(`href="${l}"`)) guideBad.push(`${rel}（缺内链 ${l}）`);
  if (!sitemapTxt.includes(`https://www.reflex-hub.com/${gp.path}`)) guideBad.push(`${rel}（未进 sitemap）`);
  const body = t.split('<main')[1] || '';
  if (body.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length < 800) guideBad.push(`${rel}（正文过短）`);
}
R.check('N12 两篇新指南页结构/数据表/内链/canonical/sitemap 齐全', guideBad.length === 0, guideBad.join(' | ') || '全部合规');
R.check('N12b 指南目录页存在且三篇指南互链、页脚含计算指南入口',
  existsSync(join(DIST, 'guides/index.html')) &&
  ['llm-api-cost/', 'llm-api-pricing-comparison/', 'llm-api-cost-examples/'].every(g => read('guides/index.html').includes(`href="${g}"`)) &&
  pages.every(f => f.endsWith('404.html') || readFileSync(f, 'utf8').includes('guides/')));
const guidesIdx = read('guides/index.html');
R.check('N14 指南中心：标题为"LLM API 成本与模型选型指南"且按三类分组、卡片均为普通 HTML 链接',
  guidesIdx.includes('<title>LLM API 成本与模型选型指南 | Reflex Hub</title>') &&
  guidesIdx.includes('<h1>LLM API 成本与模型选型指南</h1>') &&
  ['API 成本计算', '模型定价与对比', '应用场景案例'].every(c => guidesIdx.includes(`>${c}<`)) &&
  (guidesIdx.match(/href="llm-api-[^"]*"/g) || []).length >= 3);
R.check('N14b 首页含"开发指南与成本案例"卡片入口（静态链接到 /guides/）',
  home.includes('href="guides/"') && home.includes('开发指南与成本案例'));
R.check('N14c 指南中心被主导航覆盖：/guides/ 出现在共享导航且 active=开发指南',
  guidesIdx.includes('<li><a href="../guides/" class="active" aria-current="page">开发指南</a></li>'));

/* N13 广告安全：默认不加载广告脚本；无正式 Publisher ID 不生成 ads.txt；广告说明与实际配置一致 */
const adsCfg = JSON.parse(readFileSync(join(DIST, 'assets/data/ads.json'), 'utf8'));
R.check('N13 广告默认关闭：ads.json enabled=false 且无 Publisher ID', adsCfg.enabled !== true && adsCfg.publisherId == null);
let adLeak = [];
for (const file of pages) {
  const t = readFileSync(file, 'utf8');
  if (/googlesyndication|adsbygoogle|doubleclick\.net|googletagmanager|fundingchoices/i.test(t)) adLeak.push(relative(DIST, file));
  if (t.includes('data-ad-slot')) adLeak.push(relative(DIST, file) + '（残留广告容器）');
}
R.check('N13b 全站 HTML 零广告脚本引用、零广告容器（默认配置）', adLeak.length === 0, adLeak.join(' | ') || '零引用');
const appTxt = read('assets/app.js');
R.check('N13c app.js 广告加载器带四重闸（enabled/Publisher ID 格式/生产域名/CMP 认证状态）',
  appTxt.includes("location.hostname !== 'www.reflex-hub.com'") &&
  appTxt.includes('/^ca-pub-\\d{16}$/') &&
  appTxt.includes("cfg.cmp.status !== 'google-certified'") &&
  appTxt.includes('cfg.enabled !== true'));
const adsTxtPath = join(DIST, 'ads.txt');
const adsTxtOk = !existsSync(adsTxtPath) ||
  (isValidPub(adsCfg.publisherId) && readFileSync(adsTxtPath, 'utf8').includes(`google.com, ${adsCfg.publisherId.replace('ca-pub-', 'pub-')}, DIRECT, f08c47fec0942fa0`));
function isValidPub(s) { return typeof s === 'string' && /^ca-pub-\d{16}$/.test(s); }
R.check('N13d 无正式 Publisher ID 时不生成 ads.txt（或有配置时内容匹配）', adsTxtOk, existsSync(adsTxtPath) ? 'ads.txt 已存在且与配置匹配' : 'ads.txt 不存在（符合预期）');
R.check('N13e 渲染闸：默认配置/无效 ID/未登记位置输出空串', adSlotHtml({ enabled: false, publisherId: null, slots: { a: {} } }, 'a') === '' &&
  adSlotHtml({ enabled: true, publisherId: 'ca-pub-123', slots: { a: {} } }, 'a') === '' &&
  adSlotHtml({ enabled: true, publisherId: 'ca-pub-1234567890123456', slots: {} }, 'a') === '');
const privacyTxt = read('privacy/index.html');
R.check('N13f 隐私政策与实际一致（明确当前零广告 + 未来 AdSense 将部署认证 CMP）',
  privacyTxt.includes('未接入任何广告') && privacyTxt.includes('认证') && privacyTxt.includes('欧洲经济区'));

R.summary();
