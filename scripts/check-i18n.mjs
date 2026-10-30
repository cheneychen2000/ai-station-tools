/**
 * 中英双语架构专项校验（路由映射 / 语言切换 / hreflang / canonical / sitemap 一致性）。
 *
 *  I1  路由映射构建期校验通过（唯一 URL、合法语言代码、/en/ 前缀规范）+ 英文字典覆盖全部事实枚举
 *  I2  首页双向切换（映射计算 + 实际 HTML 链接一致）
 *  I3  模型详情双向切换到同一模型（glm-53-flash 中英页）
 *  I4  未翻译页面回退：模型详情→英文模型目录；对比/指南等→英文首页
 *  I5  全站每页的语言切换链接都指向真实存在的文件（回退零 404）
 *  I6  路由映射中每条 URL 都有真实生成文件（中/英）
 *  I7  事实数据单源：英文模型页价格/来源与 models.json 一致；en/ 下无第二份模型数据
 *  I8  计算器/筛选器逻辑单源：cost-core.js、labels-en.js、lib-filter.js 双端共用；labels-en.js 与 i18n.mjs 逐字段一致
 *  I9  全站每页 hreflang 与路由映射推导完全一致（双向、绝对 URL、仅真实双语页输出）
 *  I10 全站 canonical 自引用；英文页 canonical 必须位于 /en/
 *  I11 sitemap 与路由映射一致（全部双语 URL 各一次；无映射外页面误入）
 *  I12 noindex 工具页不在 sitemap（索引策略未被双语改动）
 *  I13 语言属性：/en/ 下页面 lang=en，其余 zh-CN
 *  I14 英文模型目录覆盖全部模型；英文字典无遗漏
 *  I15 app.js 语言推荐：无强制跳转代码，localStorage 访问有降级保护
 * 运行：node scripts/check-i18n.mjs（在 build 之后执行）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, isToolIndexable, comparePairs } from './lib/manifest.mjs';
import { EN_MODELS, LOCALES, buildRouteMap, validateRouteMap, switchTarget, hreflangPairs, pageByUrl } from './lib/locales.mjs';
import { assertEnCoverage, EN_VENDOR, EN_MODALITY, EN_FEATURE, EN_TIER_DESC, EN_PROMPT_SCENE, EN_PROMPT_TAG, EN_PROMPT_TITLE, EN_MODEL_NAME } from './lib/i18n.mjs';

const R = createReporter('check-i18n');
const { models, tools, pagesMeta, compares } = loadData();
const read = rel => readFileSync(join(DIST, rel), 'utf8');

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const pageFiles = walk(DIST).map(f => relative(DIST, f).replace(/\\/g, '/'));
const pageUrl = rel => '/' + rel.replace(/index\.html$/, '');
const fileExistsForUrl = url => existsSync(join(DIST, url.replace(/^\//, ''), 'index.html'));

/* I1 映射与字典（异常即构建级错误，这里转为 FAIL 记录） */
let map = null, mapErr = null, dictErr = null;
try { map = validateRouteMap(buildRouteMap(pagesMeta, models, comparePairs(models, compares.extraPairs || []), tools)); } catch (e) { mapErr = e.message; }
try { assertEnCoverage(models); } catch (e) { dictErr = e.message; }
R.check('I1 路由映射合法 + 英文字典覆盖全部事实枚举', !!map && !dictErr, (mapErr || dictErr) || '全部通过');
if (!map) { R.summary(); process.exit(1); }

/* I2~I4 切换目标（映射计算）与实际 HTML 链接 */
R.check('I2 首页双向切换目标',
  switchTarget(map, '/', 'en') === '/en/' && switchTarget(map, '/en/', 'zh-CN') === '/' &&
  read('index.html').includes('class="lang-switch" href="/en/"') &&
  read('en/index.html').includes('class="lang-switch" href="/"'));
R.check('I3 模型详情双向切换到同一模型',
  switchTarget(map, '/models/glm-53-flash/', 'en') === '/en/models/glm-53-flash/' &&
  switchTarget(map, '/en/models/glm-53-flash/', 'zh-CN') === '/models/glm-53-flash/' &&
  read('models/glm-53-flash/index.html').includes('class="lang-switch" href="/en/models/glm-53-flash/"') &&
  read('en/models/glm-53-flash/index.html').includes('class="lang-switch" href="/models/glm-53-flash/"'));
R.check('I4 全类型切换直达（对比/工具/指南/模型目录均为精确对应，不再回退）',
  switchTarget(map, '/models/deepseek-v41-flash/', 'en') === '/en/models/deepseek-v41-flash/' &&
  switchTarget(map, '/compare/', 'en') === '/en/compare/' &&
  switchTarget(map, '/compare/glm-53/glm-53-flash/', 'en') === '/en/compare/glm-53/glm-53-flash/' &&
  switchTarget(map, '/tools/deepseek-chat/', 'en') === '/en/tools/deepseek-chat/' &&
  switchTarget(map, '/guides/llm-api-cost/', 'en') === '/en/guides/llm-api-cost/' &&
  switchTarget(map, '/en/guides/make-llm-workflow/', 'zh-CN') === '/guides/make-llm-workflow/');

/* I16 全覆盖：所有可索引中文页面（映射内）都有真实英文对应（404 除外，不在映射内） */
const noEn = map.filter(e => e.indexable && !e.routes.en);
R.check('I16 全部可索引中文页面均有英文对应（无遗漏、无伪造）', noEn.length === 0,
  noEn.map(e => `${e.id}(${e.routes['zh-CN']})`).join(' | ') || `全部 ${map.filter(e => e.indexable).length} 个可索引页面双语齐备`);

/* I5 全站切换链接零 404 */
let switchBad = [];
for (const rel of pageFiles) {
  const t = read(rel);
  const hrefs = [...t.matchAll(/<a class="lang-switch" href="([^"]+)"/g)].map(m => m[1]);
  if (hrefs.length !== 1) { switchBad.push(`${rel}（切换链接数=${hrefs.length}）`); continue; }
  const target = join(DIST, hrefs[0].replace(/^\//, ''), 'index.html');
  if (!existsSync(target)) switchBad.push(`${rel} → ${hrefs[0]}（目标不存在）`);
}
R.check(`I5 全站 ${pageFiles.length} 页各恰一条语言切换链接且目标文件真实存在`, switchBad.length === 0,
  switchBad.slice(0, 5).join(' | ') || '零 404');

/* I6 映射 URL → 文件存在 */
let missing = [];
for (const e of map) for (const url of Object.values(e.routes)) if (!fileExistsForUrl(url)) missing.push(url);
R.check('I6 路由映射全部 URL 对应真实生成文件', missing.length === 0, missing.join(' | ') || '全部存在');

/* I7 事实数据单源 */
const g = models.find(m => m.id === 'glm-53-flash');
const glmEn = read('en/models/glm-53-flash/index.html');
R.check('I7 英文模型页事实与 models.json 一致且 en/ 下无第二份数据',
  glmEn.includes(`¥${g.priceIn}`) && glmEn.includes(`¥${g.priceOut}`) && glmEn.includes(g.sourceUrl) &&
  !existsSync(join(DIST, 'en/assets')));

/* I8 逻辑单源：共享脚本存在且被双端引用；labels-en.js 与 i18n.mjs 一致 */
const cnCost = read('cost/index.html'), enCost = read('en/cost/index.html');
const w = {};
new Function('window', read('assets/labels-en.js'))(w);
const labelsSame = JSON.stringify(w.EnLabels) === JSON.stringify({ vendor: EN_VENDOR, modality: EN_MODALITY, feature: EN_FEATURE, tierDesc: EN_TIER_DESC.map(x => [...x]), promptScene: EN_PROMPT_SCENE, promptTag: EN_PROMPT_TAG, promptTitle: EN_PROMPT_TITLE });
R.check('I8 共享计算/筛选/字典脚本双端复用且生成物与源一致',
  cnCost.includes('cost-core.js') && enCost.includes('cost-core.js') && /* 公式核心仍为双端同一份固定 URL 库 */
  read('models/index.html').includes('_astro') && read('en/models/index.html').includes('_astro') && /* 筛选模块经打包产物加载 */
  existsSync(join(DIST, 'assets/labels-en.js')) && /* 字典生成物仍为公开资产（端点生成） */
  labelsSame);

/* I9 每页 hreflang 与映射推导一致 */
let altBad = [];
for (const rel of pageFiles) {
  const url = pageUrl(rel);
  const t = read(rel);
  const actual = [...t.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => ({ lang: m[1], url: m[2] }));
  /* noindex 页面（第三方工具薄页）按策略不输出 hreflang */
  const entry = pageByUrl(map, url);
  const expected = entry && entry.indexable && !/noindex/.test(t)
    ? hreflangPairs(map, url).map(a => ({ lang: a.lang, url: SITE + a.url }))
    : [];
  const key = arr => arr.map(a => `${a.lang}=${a.url}`).sort().join(',');
  if (key(actual) !== key(expected)) altBad.push(`${rel}（期望 ${key(expected) || '无'} 实际 ${key(actual) || '无'}）`);
}
R.check(`I9 全站 ${pageFiles.length} 页 hreflang 与路由映射推导完全一致`, altBad.length === 0,
  altBad.slice(0, 5).join(' | ') || '全部一致');

/* I10 canonical 自引用且语言归属正确 */
let canonBad = [];
for (const rel of pageFiles) {
  const url = pageUrl(rel);
  if (rel === '404.html') continue;
  const t = read(rel);
  const canon = (t.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (canon !== SITE + url) canonBad.push(rel);
  if (rel.startsWith('en/') && !String(canon).startsWith(SITE + '/en/')) canonBad.push(`${rel}（英文 canonical 不在 /en/）`);
}
R.check('I10 canonical 自引用且英文页位于 /en/', canonBad.length === 0, canonBad.slice(0, 5).join(' | ') || '全部自引用');

/* I11 sitemap ↔ 映射 */
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const mapUrls = new Set(map.flatMap(e => Object.values(e.routes)));
let smBad = [];
for (const e of map) {
  if (!e.indexable) continue;
  for (const url of Object.values(e.routes)) if (!locs.includes(SITE + url)) smBad.push(`${url}（映射页未进 sitemap）`);
}
const toolUrls = new Set(tools.filter(t => isToolIndexable(t)).map(t => `/tools/${t.id}/`));
for (const u of locs) {
  const path = u.replace(SITE, '');
  if (mapUrls.has(path) || path.startsWith('/compare/') || toolUrls.has(path)) continue;
  smBad.push(`${path}（映射外 URL 误入 sitemap）`);
}
R.check('I11 sitemap 与路由映射/生成页集合一一对应', smBad.length === 0, smBad.slice(0, 5).join(' | ') || '一致');

/* I12 noindex 工具页不在 sitemap */
const noindexToolsInSitemap = tools.filter(t => !t.own && !isToolIndexable(t) && locs.includes(`${SITE}/tools/${t.id}/`));
R.check('I12 noindex 工具页未进入 sitemap', noindexToolsInSitemap.length === 0, noindexToolsInSitemap.map(t => t.id).join(',') || '符合');

/* I13 语言属性 */
const langBad = pageFiles.filter(rel => {
  const lang = (read(rel).match(/<html lang="([^"]+)"/) || [])[1];
  return rel.startsWith('en/') ? lang !== 'en' : lang !== 'zh-CN';
});
R.check('I13 页面 lang 属性正确（en/ 下 en，其余 zh-CN）', langBad.length === 0, langBad.join(' | ') || '全部正确');

/* I14 英文模型目录覆盖全部模型 + 卡片内链存在 */
const enModelsIdx = read('en/models/index.html');
R.check('I14 英文模型目录覆盖全部模型（静态卡片存在，名称走 EN_MODEL_NAME 字典）',
  models.every(m => enModelsIdx.includes(EN_MODEL_NAME[m.id] || m.name)) &&
  EN_MODELS.every(id => enModelsIdx.includes(`href="${id}/"`)));

/* I15 语言推荐脚本安全（全站共享脚本已迁移为 src/scripts/app.ts 的打包产物，按命名定位） */
const appChunkName = readdirSync(join(DIST, '_astro')).find(n => n.startsWith('SiteLayout.astro_astro_type_script'));
if (!appChunkName) throw new Error('未找到全站共享脚本打包产物');
const appJs = readFileSync(join(DIST, '_astro', appChunkName), 'utf8');
R.check('I15 全站共享脚本语言推荐无强制跳转、localStorage 访问有降级',
  !/location\.(href|replace|assign)\s*[=(]/.test(appJs) &&
  /try\s*\{\s*pref = localStorage\.getItem/.test(appJs) && /* esbuild 打印会重排行内 try，按语义正则匹配 */
  appJs.includes('lang-switch'));

/* I17 英文页可见文本零中文（白名单：语言切换器"中文"标签；提示词本体为中文内容资产，单独豁免 en/prompts 正文卡片区由字典覆盖其标题/场景/标签） */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\sdata-[a-z-]+="[^"]*"/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}
const CJK = /[一-鿿][一-鿿\w·（）()：:，,、\-—%.]*|[（），、：]/g;
let cjkBad = [];
for (const rel of pageFiles.filter(r => r.startsWith('en/'))) {
  const t = visibleText(read(rel));
  const hits = [...new Set((t.match(CJK) || []).map(x => x.trim()).filter(x => x && x !== '中文'))];
  if (hits.length) cjkBad.push(`${rel}（${hits.slice(0, 6).join('|')}）`);
}
R.check(`I17 英文页可见文本零中文（${pageFiles.filter(r => r.startsWith('en/')).length} 页全扫，白名单：中文切换器）`, cjkBad.length === 0,
  cjkBad.slice(0, 5).join(' | ') || '全部干净');

R.summary();
