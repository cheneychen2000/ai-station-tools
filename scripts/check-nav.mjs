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
  if (rel.startsWith('cost/') || rel.startsWith('guides/')) return 'cost';
  if (rel.startsWith('models/')) return 'models';
  if (rel.startsWith('compare/')) return 'compare';
  if (rel.startsWith('tools/')) return 'tools';
  if (rel.startsWith('prompts/')) return 'prompts';
  return null; /* quiz / about / 404：无当前栏目 */
}

const NAV_LABELS = ['成本计算器', '模型库', '模型对比', 'AI 工具目录', 'Prompt 资源'];
let navBad = [], linkBad = [], activeBad = [], skipBad = [], footerBad = [];

for (const file of pages) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const txt = readFileSync(file, 'utf8');
  const is404 = rel === '404.html';

  /* 跳到正文链接 + 正文锚点 */
  if (!txt.includes('<a class="skip-link" href="#main">跳到正文</a>') || !txt.includes('id="main"')) skipBad.push(rel);

  /* 主导航：唯一、语义化、顺序与文案一致 */
  const navBlock = (txt.match(/<nav class="site-nav" aria-label="主导航">[\s\S]*?<\/nav>/) || [])[0];
  if (!navBlock) { navBad.push(`${rel}（缺主导航）`); continue; }
  const items = [...navBlock.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
  if (items.map(m => m[3]).join('|') !== NAV_LABELS.join('|')) navBad.push(`${rel}（导航项顺序/文案不符）`);

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
  const activeKey = expect && expect !== 'home' ? expect : null;
  if (activeKey) {
    const target = NAV_LABELS[{ cost: 0, models: 1, compare: 2, tools: 3, prompts: 4 }[activeKey]];
    if (currents.length !== 1 || currents[0][3] !== target || !currents[0][2].includes('class="active"')) {
      activeBad.push(`${rel}（期望 ${target} 唯一 aria-current+active）`);
    }
  } else if (currents.length !== 0) activeBad.push(`${rel}（不应出现 aria-current）`);
  if (expect === 'home' && !txt.includes('<a class="brand" href="./" aria-current="page">')) activeBad.push(`${rel}（首页品牌缺 aria-current）`);

  /* 导航目标 URL 全部存在 */
  for (const m of items) {
    const href = m[1];
    const target = href.startsWith('/') ? join(DIST, href, 'index.html') : resolve(dirname(file), href, 'index.html');
    if (!existsSync(target)) linkBad.push(`${rel}（导航死链 ${href}）`);
  }

  /* 页脚站内导航区（404 无页脚，豁免） */
  if (!is404) {
    if (!txt.includes('<nav class="footer-nav" aria-label="页脚导航">') ||
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

R.summary();
