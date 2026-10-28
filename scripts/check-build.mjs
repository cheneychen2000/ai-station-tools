/** 构建产物校验：幂等性、页面数量、URL 归一、sitemap 清单一致性、价格传播、静态内容、索引策略 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DIST } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, buildManifest, comparePairs, isToolIndexable } from './lib/manifest.mjs';
import { monthly, money, price, verdict } from './lib/pricing.mjs';
import { esc, safeUrl, jsonld } from './lib/escape.mjs';

const R = createReporter('check-build');

function walk(dir, base = '') {
  let out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(p).isDirectory()) out = out.concat(walk(p, rel));
    else out.push(rel);
  }
  return out;
}
function hashDist() {
  const h = createHash('sha1');
  for (const rel of walk(DIST)) h.update(rel + '\0' + readFileSync(join(DIST, rel)));
  return h.digest('hex');
}

const run = () => execSync(`node "${join(ROOT, 'scripts', 'build.mjs')}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
console.log(run());
const h1 = hashDist();
run();
const h2 = hashDist();
R.check('B1 幂等（连跑两次产物逐字节一致）', h1 === h2);

const { models, tools, pagesMeta } = loadData();
const N = models.length;
const PAIRS = (N * (N - 1)) / 2;

const modelDirs = readdirSync(join(DIST, 'models')).filter(d => statSync(join(DIST, 'models', d)).isDirectory());
R.check(`B2 模型详情页数 = ${modelDirs.length}（期望 ${N}）`, modelDirs.length === N);

const pairDirs = readdirSync(join(DIST, 'compare')).filter(d => statSync(join(DIST, 'compare', d)).isDirectory());
let pairCount = 0, normalized = true;
for (const a of pairDirs) {
  for (const b of readdirSync(join(DIST, 'compare', a))) {
    if (!statSync(join(DIST, 'compare', a, b)).isDirectory()) continue;
    pairCount++;
    if (!(a < b)) normalized = false;
  }
}
R.check(`B3 对比页数 = ${pairCount}（期望 ${PAIRS}）`, pairCount === PAIRS);
R.check('B3b 对比页 URL 全部归一（a<b）', normalized);

const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const manifest = buildManifest({ models, tools, pagesMeta });
R.check(`B4 sitemap URL 数 = ${locs.length}（与页面清单 ${manifest.length} 一致）`, locs.length === manifest.length);

const extTools = tools.filter(t => !t.own);
const T = extTools.length;
const toolDirs = readdirSync(join(DIST, 'tools')).filter(d => statSync(join(DIST, 'tools', d)).isDirectory());
R.check(`B6 工具详情页数 = ${toolDirs.length}（期望 ${T}）`, toolDirs.length === T);

const CATS = ['自研', '对话', '绘图', '视频', '编程', '办公'];
const toolsOk = T >= 10 && tools.every(t =>
  t.id && t.name && t.tagline && CATS.includes(t.category) &&
  ['免费', 'freemium', '付费'].includes(t.free) &&
  (t.own ? /^\//.test(t.url) : /^https:\/\//.test(t.url)) &&
  t.scene && t.verifiedAt &&
  (t.own || typeof t.indexable === 'boolean')); /* 第三方工具必须显式记录布尔索引审核结论 */
R.check(`B7 tools.json 字段合法（外部 ${T} 条 / 自研 ${tools.length - T} 条，含布尔 indexable）`, toolsOk);

const prompts = JSON.parse(readFileSync(join(DIST, 'assets/data/prompts.json'), 'utf8'));
const promptsOk = prompts.length >= 10 && prompts.every(p =>
  p.id && p.title && p.scene && typeof p.prompt === 'string' && p.prompt.length > 30 && Array.isArray(p.tags));
R.check(`B8 prompts.json 字段合法且 ≥10 条（${prompts.length} 条）`, promptsOk);

/* B5 价格传播：动态取样（不再写死模型 ID），预期值由 models.json 计算 */
const sample = models.find(m => !m.peakOffpeak && m.priceIn != null) || models[0];
const detail = readFileSync(join(DIST, 'models', sample.id, 'index.html'), 'utf8');
R.check(`B5 价格传播（${sample.id} 详情页含 ${price(sample.priceIn)}）`, detail.includes(price(sample.priceIn)));

const [pa, pb] = comparePairs(models)[0];
const ma = models.find(m => m.id === pa), mb = models.find(m => m.id === pb);
const pair = readFileSync(join(DIST, 'compare', pa, pb, 'index.html'), 'utf8');
R.check(`B5b 对比页含两款模型名（${ma.name} / ${mb.name}）`, pair.includes(ma.name) && pair.includes(mb.name));

/* B9 示例月成本：公式与 /cost 默认值一致；静态成本参考表全模型逐项核对 */
const costHtml = readFileSync(join(DIST, 'cost/index.html'), 'utf8');
let costTableOk = true;
for (const m of models) {
  if (!costHtml.includes(money(monthly(m)))) { costTableOk = false; R.fail(`B9 成本参考表缺 ${m.id} 的估算值 ${money(monthly(m))}`); }
}
R.check('B9 /cost/ 静态参考表覆盖全部模型的公式估算值', costTableOk);
R.check('B9b 对比页示例月成本与公式一致', pair.includes(money(monthly(ma))) && pair.includes(money(monthly(mb))));
R.check('B9c 对比页含示例参数脚注（日均 100 次调用）', pair.includes('日均 100 次调用'));
R.check('B9d 平局判定函数（同值=tie / 低者胜出 / 精度内=tie）',
  verdict(1, 1) === 'tie' && verdict(1, 2) === 'a' && verdict(2, 1) === 'b' && verdict(1, 1.001) === 'tie');

/* B10 列表页静态内容：模型/工具卡片必须存在于原始 HTML（不依赖客户端 fetch） */
const modelsIndex = readFileSync(join(DIST, 'models/index.html'), 'utf8');
R.check('B10 /models/ 全部模型名称与详情链接存在于静态 HTML',
  models.every(m => modelsIndex.includes(m.name) && modelsIndex.includes(`href="${m.id}/"`)));
const toolsIndex = readFileSync(join(DIST, 'tools/index.html'), 'utf8');
R.check('B10b /tools/ 全部工具名称存在于静态 HTML', tools.every(t => toolsIndex.includes(t.name)));
R.check('B10c /tools/ 自研分组置顶保留', toolsIndex.includes('本站自研工具'));
R.check('B10d 列表页不再含 fetch 渲染卡片脚本',
  !/fetch\([^)]*models\.json/.test(modelsIndex) && !/fetch\([^)]*tools\.json/.test(toolsIndex));

/* B11 页脚静态合规：所有页面（除 404）无需 JS 即含合规文字与导航 */
let footerBad = [];
for (const rel of walk(DIST).filter(f => f.endsWith('.html') && f !== '404.html')) {
  const txt = readFileSync(join(DIST, rel), 'utf8');
  if (!txt.includes('不构成任何采购建议') || !txt.includes('关于本站')) footerBad.push(rel);
}
R.check('B11 全站页脚静态合规文字齐全', footerBad.length === 0, footerBad.join(', ') || '全部页面含免责声明与关于本站链接');

/* B12 索引策略：第三方工具页 noindex,follow 且不进 sitemap；模型/对比页无错误 Offer */
let idxBad = [];
for (const t of extTools) {
  const txt = readFileSync(join(DIST, 'tools', t.id, 'index.html'), 'utf8');
  const hasNoindex = txt.includes('<meta name="robots" content="noindex,follow">');
  if (isToolIndexable(t) === hasNoindex) idxBad.push(t.id);
  if (!isToolIndexable(t) && locs.some(u => u.endsWith(`/tools/${t.id}/`))) idxBad.push(t.id + '(误入 sitemap)');
}
R.check('B12 工具页 robots 指令与 indexable 及 sitemap 一致', idxBad.length === 0, idxBad.join(', ') || '12 个薄页均 noindex,follow 且不在 sitemap');
let offerBad = models.filter(m => readFileSync(join(DIST, 'models', m.id, 'index.html'), 'utf8').includes('"offers"')).map(m => m.id);
R.check('B13 模型详情页不再把 API 单价表示为软件购买 Offer', offerBad.length === 0, offerBad.join(', ') || '全部移除');
let toolOfferBad = [];
for (const t of extTools) {
  const txt = readFileSync(join(DIST, 'tools', t.id, 'index.html'), 'utf8');
  const hasOffer = txt.includes('"offers"');
  if (t.free === '免费' ? !hasOffer : hasOffer) toolOfferBad.push(t.id);
}
R.check('B13b 工具页 Offer 仅出现在"免费"工具（freemium/付费不输出）', toolOfferBad.length === 0, toolOfferBad.join(', ') || '符合');

/* B14 输出安全工具自检：转义 / URL 协议校验 / JSON-LD 防闭合 */
R.check('B14 esc() 转义 HTML 特殊字符', esc('<img src=x onerror="alert(1)">') === '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
R.check('B14b safeUrl() 拦截 javascript: 等非 http(s) 协议', safeUrl('javascript:alert(1)') === null && safeUrl('https://a.com/x') === 'https://a.com/x');
R.check('B14c JSON-LD 序列化防 </script> 闭合', !jsonld({ x: '</script><script>alert(1)</script>' }).includes('</script>'));

/* B15 /cost/ FAQPage 结构化数据有可见正文对应 */
R.check('B15 /cost/ FAQ 三个问题均有可见正文', ['这个计算器怎么算？', 'DeepSeek 低谷价什么时候适用？', '缓存命中率是什么意思？'].every(q => costHtml.includes(q)));

R.summary();
