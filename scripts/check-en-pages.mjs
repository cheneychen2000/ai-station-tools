/**
 * 英文版 MVP 专项校验（/en/ 三页）：
 *  E1  三页存在且 <html lang="en">；title/description/H1 齐全、英文页间唯一、无中日韩字符混入
 *  E2  canonical 自引用（www HTTPS 尾斜杠）且与 og:url 一致
 *  E3  hreflang 双向精确：英文页 en 自身 + zh-CN 指向真正对应的中文页；中文对应页回指英文页；
 *      白名单之外的中文页不得出现 hreflang="en"（防止错误映射）
 *  E4  英文页无 noindex；robots.txt 未屏蔽 /en/；sitemap 恰含 3 条英文规范 URL
 *  E5  JSON-LD 可解析、URL 为英文页、无虚构评分/评论
 *  E6  共享计算核心 assets/cost-core.js 与 scripts/lib/pricing.mjs 逐模型参数网格对拍（含未核实档位 null 语义）
 *  E7  中英计算器均调用 CostCore（无第二套公式）；英文计算器脚本无价格硬编码
 *  E8  币种口径：英文页价格保留官方原币（GLM-5.3-Flash 为 CNY），含来源、单位与核验日期
 *  E9  GLM-5.3-Flash 英文页关键事实与 models.json 一致（价格/上下文/来源/核验日期）
 * 运行：node scripts/check-en-pages.mjs（在 build 之后执行）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData } from './lib/manifest.mjs';
import { rateFor, monthly } from './lib/pricing.mjs';

const R = createReporter('check-en-pages');
const { models } = loadData();
const read = rel => readFileSync(join(DIST, rel), 'utf8');

const EN_PAGES = {
  'en/index.html': { url: '/en/', cn: '/', title: null },
  'en/cost/index.html': { url: '/en/cost/', cn: '/cost/', title: null },
  'en/models/glm-53-flash/index.html': { url: '/en/models/glm-53-flash/', cn: '/models/glm-53-flash/', title: null }
};

/* E1 存在 + lang + 元数据 */
let missing = [], langBad = [], metaBad = [];
const titleSeen = new Set();
const CJK = /[぀-ヿ㐀-鿿가-힯]/;
for (const [rel, info] of Object.entries(EN_PAGES)) {
  if (!existsSync(join(DIST, rel))) { missing.push(rel); continue; }
  const t = read(rel);
  if (!t.includes('<html lang="en">')) langBad.push(rel);
  const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (t.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const h1 = (t.match(/<h1[ >][\s\S]*?<\/h1>/) || [])[0] || '';
  info.title = title;
  if (!title || !desc || !h1) metaBad.push(`${rel}（title/description/H1 缺失）`);
  if (title && (CJK.test(title) || CJK.test(desc))) metaBad.push(`${rel}（title/description 混入非英文）`);
  if (titleSeen.has(title)) metaBad.push(`${rel}（标题与另一英文页重复）`);
  titleSeen.add(title);
}
R.check('E1 三个英文页存在、lang=en、title/description/H1 齐全且唯一', missing.length === 0 && langBad.length === 0 && metaBad.length === 0,
  [...missing, ...langBad, ...metaBad].join(' | ') || '3 页全部合规');

/* E2 canonical 自引用 + og:url 一致 */
let canonBad = [];
for (const [rel, info] of Object.entries(EN_PAGES)) {
  const t = read(rel);
  const canonicals = [...t.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(m => m[1]);
  const og = (t.match(/<meta property="og:url" content="([^"]+)"/) || [])[1];
  if (canonicals.length !== 1 || canonicals[0] !== SITE + info.url) canonBad.push(`${rel}（canonical=${canonicals.join(',')}）`);
  if (og !== SITE + info.url) canonBad.push(`${rel}（og:url=${og}）`);
}
R.check('E2 canonical 每页恰一条且自引用、og:url 与 canonical 一致', canonBad.length === 0, canonBad.join(' | ') || '3 页全部自引用');

/* E3 hreflang 双向精确 + 白名单外零映射 */
let altBad = [];
for (const [rel, info] of Object.entries(EN_PAGES)) {
  const t = read(rel);
  const links = Object.fromEntries([...t.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => [m[1], m[2]]));
  if (links.en !== SITE + info.url) altBad.push(`${rel}（缺 en 自身 hreflang）`);
  if (links['zh-CN'] !== SITE + info.cn) altBad.push(`${rel}（zh-CN 未指向对应中文页 ${info.cn}）`);
  const cnRel = info.cn.replace(/^\//, '') + 'index.html';
  const cnTxt = read(cnRel);
  const back = (cnTxt.match(new RegExp(`<link rel="alternate" hreflang="en" href="([^"]+)"`)) || [])[1];
  if (back !== SITE + info.url) altBad.push(`${cnRel}（未回指英文页）`);
}
/* 全站扫描：除 3 个中文对应页外不得出现 hreflang="en" */
function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const cnCounterparts = new Set(Object.values(EN_PAGES).map(i => i.cn.replace(/^\//, '') + 'index.html'));
let strayAlt = [];
for (const f of walk(DIST)) {
  const rel = relative(DIST, f).replace(/\\/g, '/');
  if (rel.startsWith('en/')) continue;
  if (cnCounterparts.has(rel)) continue;
  if (read(rel).includes('hreflang="en"')) strayAlt.push(rel);
}
R.check('E3 hreflang 双向精确（en↔zh-CN 三对），白名单外零 en 映射', altBad.length === 0 && strayAlt.length === 0,
  [...altBad, ...strayAlt].join(' | ') || '3 对双向、零 stray');

/* E4 robots / sitemap / noindex */
const robots = read('robots.txt');
R.check('E4a robots.txt 未屏蔽 /en/（无 Disallow 命中）',
  !/Disallow:[^\n]*\/en([\s\n$\/]|$)/m.test(robots) && !/Disallow:\s*\//m.test(robots));
let robotBad = [];
for (const rel of Object.keys(EN_PAGES)) {
  if (/noindex/.test(read(rel))) robotBad.push(rel);
}
R.check('E4b 英文页无 noindex', robotBad.length === 0, robotBad.join(' | ') || '全部可索引');
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
let smBad = [];
for (const info of Object.values(EN_PAGES)) {
  const n = locs.filter(u => u === SITE + info.url).length;
  if (n !== 1) smBad.push(`${info.url}（出现 ${n} 次）`);
}
R.check('E4c sitemap 恰含 3 条英文规范 URL（各一次）', smBad.length === 0, smBad.join(' | ') || '3 条齐全');

/* E5 JSON-LD */
let ldBad = [];
for (const [rel, info] of Object.entries(EN_PAGES)) {
  const t = read(rel);
  const blocks = [...t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { ldBad.push(`${rel}（无 JSON-LD）`); continue; }
  for (const m of blocks) {
    let o;
    try { o = JSON.parse(m[1]); } catch (e) { ldBad.push(`${rel}（JSON-LD 解析失败）`); continue; }
    if (/"@type"\s*:\s*"(AggregateRating|Review)"/.test(m[1])) ldBad.push(`${rel}（虚构评分/评论）`);
    for (const ld of Array.isArray(o) ? o : [o]) {
      if (ld.url && !String(ld.url).startsWith(SITE)) ldBad.push(`${rel}（url 域名异常）`);
      if (ld['@type'] === 'BreadcrumbList') {
        for (const it of ld.itemListElement || []) if (!String(it.item).startsWith(SITE)) ldBad.push(`${rel}（面包屑 URL 异常）`);
      }
    }
  }
}
R.check('E5 英文页 JSON-LD 可解析、域名规范、无虚构结构', ldBad.length === 0, ldBad.join(' | ') || '全部合规');

/* E6 共享计算核心与 pricing.mjs 对拍（逐模型 × 参数网格，含 null/NaN 语义） */
const core = (await import('../dist/assets/cost-core.js')).default || globalThis.CostCore;
let parBad = [];
for (const m of models) {
  for (const offpeak of [true, false]) {
    for (const hit of [0, 0.3, 0.6, 0.9, 1]) {
      for (const inTok of [0, 2000, 600000]) {
        const calls = 137, outTok = 811; /* 非默认参数，防巧合通过 */
        const got = core.effectiveInputPrice(m, { offpeak, inTok }, hit);
        let exp = null;
        if (m.peakOffpeak) {
          const b = offpeak
            ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
            : { i: m.peakOffpeak.peakIn, c: m.peakOffpeak.peakCache, o: m.peakOffpeak.peakOut };
          exp = { i: b.i, c: b.c, o: b.o };
        } else {
          const r = rateFor(m, inTok);
          exp = r.unavailable ? null : { i: r.i, c: r.c, o: r.o };
        }
        if ((got === null) !== (exp === null)) { parBad.push(`${m.id} off=${offpeak} hit=${hit} in=${inTok}（null 语义不一致）`); continue; }
        if (got) {
          const effIn = exp.c == null ? exp.i : hit * exp.c + (1 - hit) * exp.i;
          if (Math.abs(got.effIn - effIn) > 1e-9 || got.output !== exp.o) { parBad.push(`${m.id} off=${offpeak} hit=${hit} in=${inTok}（单价不一致）`); continue; }
          const mc = core.monthlyCost(got, calls, inTok, outTok);
          const tExp = calls * 30 * (inTok / 1e6) * effIn + calls * 30 * (outTok / 1e6) * exp.o;
          if (Math.abs(mc.total - tExp) > 1e-6) parBad.push(`${m.id} off=${offpeak} hit=${hit} in=${inTok}（月成本不一致）`);
        } else {
          /* 未核实档位：pricing.monthly 应为 NaN（核心为 null，语义对齐） */
          if (!Number.isNaN(monthly(m, { calls, inTok, outTok, hit })) && !m.peakOffpeak) {
            parBad.push(`${m.id} in=${inTok}（未核实档位 pricing.monthly 应为 NaN）`);
          }
        }
      }
    }
  }
}
R.check(`E6 cost-core.js 与 pricing.mjs 全模型参数网格对拍一致（${models.length} 款 × 30 组）`, parBad.length === 0,
  parBad.slice(0, 5).join(' | ') || '全部一致');

/* E7 中英计算器均调用 CostCore + 英文页无价格硬编码 */
const cnCost = read('cost/index.html');
const enCost = read('en/cost/index.html');
R.check('E7a 中/英计算器脚本均委托 CostCore（单一公式源）',
  cnCost.includes('cost-core.js') && cnCost.includes('window.CostCore') &&
  enCost.includes('cost-core.js') && enCost.includes('CostCore.monthlyCost'));
const enScript = enCost.split('<script>').pop();
const priceLiterals = enScript.match(/[^a-zA-Z](0\.04|0\.02|0\.3[^0-9]|0\.15|priceIn\s*[:=]\s*[\d.])/g);
R.check('E7b 英文计算器脚本无价格硬编码（与 T3b 同口径）', !priceLiterals, priceLiterals ? JSON.stringify(priceLiterals) : '无字面量');

/* E8 币种与来源口径 */
R.check('E8a 英文计算器保留原币口径声明（per 1M tokens / CNY / USD）',
  enCost.includes('per 1M tokens') && enCost.includes('CNY') && enCost.includes('USD') &&
  enCost.includes('official list prices'));
const glmEn = read('en/models/glm-53-flash/index.html');
R.check('E8b GLM-5.3-Flash 英文页含币种声明（CNY，不伪装 USD）',
  glmEn.includes('CNY (Chinese yuan)') && !glmEn.includes('$0.8'));
R.check('E8c GLM-5.3-Flash 英文页含官方来源链接与核验日期',
  glmEn.includes('https://help.aliyun.com/zh/model-studio/glm-5-3-flash-by-zhipu') && glmEn.includes('2026-10-28'));

/* E9 GLM-5.3-Flash 英文页事实与 models.json 一致 */
const g = models.find(m => m.id === 'glm-53-flash');
const expectMonthly = monthly(g); /* 默认口径月成本，与中文页/计算器一致 */
R.check('E9 GLM-5.3-Flash 英文页关键事实（价格/上下文/估算/CTA）',
  glmEn.includes(`¥${g.priceIn}`) && glmEn.includes(`¥${g.priceOut}`) && glmEn.includes(`¥${g.priceCacheHit}`) &&
  glmEn.includes(`${g.context}K`) && glmEn.includes('estimate') &&
  glmEn.includes('../../cost/?models=glm-53-flash') &&
  glmEn.includes('not constitute purchase advice'));
R.check(`E9b 英文页月成本估算与 pricing.mjs 一致（${expectMonthly.toFixed(2)} CNY）`,
  glmEn.includes(expectMonthly.toFixed(2)));

R.summary();
