/**
 * 品牌一致性检查（第二阶段：Reflex Hub）：
 * 1~11 品牌位点与公众号残留；12 规范域名；13 第一阶段索引规则与静态内容回归。
 * 历史报告（reports/）允许保留旧品牌记录，不参与扫描。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, ROOT } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';

const R = createReporter('check-brand');

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
const home = read('index.html');
const about = read('about/index.html');
const quizJs = readFileSync(join(DIST, 'assets/quiz.js'), 'utf8');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

/* 1. 首页主品牌 */
R.check('B01 首页主品牌为 Logo 图片链接（可回首页、带 aria-current 与 alt，无重复文字品牌）',
  home.includes('<a class="brand" href="./" aria-current="page"><img class="brand-logo" src="assets/logo.png" alt="Reflex Hub"') &&
  !home.includes('<a class="brand" href="./" aria-current="page">Reflex Hub</a>') &&
  home.includes('<h1>大模型 API 成本与模型选型工具</h1>'));

/* 2. 首页标题准确表达定位 */
R.check('B02 首页 title = Reflex Hub — 大模型 API 成本与模型选型工具',
  home.includes('<title>Reflex Hub — 大模型 API 成本与模型选型工具</title>'));

/* 3. About 不再把公众号作为必要入口 */
R.check('B03 About 页无公众号二维码/关注引导/公众号运营表述',
  !about.includes('公众号') && !about.includes('mp-qrcode') &&
  about.includes('github.com/cheneychen2000/ai-station-tools/issues'));

/* 4. 全站（含 Footer 主体）无旧品牌残留 */
const oldBrandHits = pages.filter(p => readFileSync(p, 'utf8').includes('AI七号驿站'));
R.check(`B04 全站 ${pages.length} 页无旧品牌"AI七号驿站"（Footer 主体=Reflex Hub）`, oldBrandHits.length === 0,
  oldBrandHits.map(p => p.replace(DIST, '')).join(' | ') || '零残留');

/* 5. 生成页品牌后缀与首页一致 */
const genPages = pages.filter(p => /[\\/]dist[\\/]compare[\\/]/.test(p) || /[\\/]dist[\\/]models[\\/]/.test(p) && p !== join(DIST, 'models/index.html') || /[\\/]dist[\\/]tools[\\/]/.test(p) && p !== join(DIST, 'tools/index.html'));
const suffixBad = genPages.filter(p => !readFileSync(p, 'utf8').includes('| Reflex Hub'));
R.check(`B05 全部 ${genPages.length} 个生成页标题品牌后缀一致`, suffixBad.length === 0,
  suffixBad.map(p => p.replace(DIST, '')).join(' | ') || '全部一致');

/* 6. WebSite 与 Organization 结构化数据为新品牌 */
const wsNodes = [...home.matchAll(/"@type":\s*"WebSite"[\s\S]*?"name":\s*"([^"]+)"/g)].map(m => m[1]);
const orgNodes = [...home.matchAll(/"@type":\s*"Organization"[\s\S]*?"name":\s*"([^"]+)"/g)].map(m => m[1]);
R.check('B06 首页 WebSite/Organization JSON-LD name = Reflex Hub',
  wsNodes.length >= 1 && orgNodes.length >= 1 && wsNodes[0] === 'Reflex Hub' && orgNodes[0] === 'Reflex Hub');

/* 7. JSON-LD 无重复冲突节点 */
R.check('B07 首页 WebSite/Organization 各恰好一个节点（无重复冲突）',
  (home.match(/"@type": "WebSite"/g) || []).length === 1 &&
  (home.match(/"@type": "Organization"/g) || []).length === 1);

/* 8. OG 元数据与当前品牌一致 */
const ogBad = pages.filter(p => {
  if (p.endsWith('404.html')) return false; /* 404 无 OG 标签（设计如此） */
  const t = readFileSync(p, 'utf8');
  if (!t.includes('og:site_name')) return true;
  return !t.includes('og:site_name" content="Reflex Hub"');
});
R.check(`B08 全站 og:site_name = Reflex Hub（${pages.length - 1} 个含 OG 页）`, ogBad.length === 0,
  ogBad.map(p => p.replace(DIST, '')).join(' | ') || '全部一致');
R.check('B08b 首页 og:title 与 title 一致', home.includes('og:title" content="Reflex Hub — 大模型 API 成本与模型选型工具"'));

/* 9. README 产品定位与网站一致 */
R.check('B09 README 为 Reflex Hub 独立产品介绍且含定位语',
  readme.includes('Reflex Hub') && readme.includes('大模型 API 成本与模型选型工具') && !readme.includes('AI七号驿站'));

/* 10. 无公众号二维码引用 */
const mpHits = pages.filter(p => readFileSync(p, 'utf8').includes('mp-qrcode'));
R.check('B10 全站无 mp-qrcode 引用', mpHits.length === 0, mpHits.map(p => p.replace(DIST, '')).join(' | ') || '零引用');

/* 11. 测验中的品牌引导已更新 */
R.check('B11 quiz.js 无公众号引导、海报与弱项入口已更新',
  !quizJs.includes('公众号') && quizJs.includes("fillText('Reflex Hub'") && quizJs.includes('阅读数据与方法说明'));

/* 12. canonical 和 sitemap 仍使用规范域名 */
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
R.check('B12 sitemap 全部为 https://www.reflex-hub.com 且 robots Sitemap 行一致',
  locs.length > 0 && locs.every(u => { try { return new URL(u).origin === SITE; } catch (e) { return false; } }) &&
  read('robots.txt').includes(`Sitemap: ${SITE}/sitemap.xml`));

/* 13. 第一阶段成果回归：索引规则 + 静态内容 + noindex 一致性 */
const toolsDirs = readdirSync(join(DIST, 'tools')).filter(d => statSync(join(DIST, 'tools', d)).isDirectory());
const noindexed = toolsDirs.filter(d => read(`tools/${d}/index.html`).includes('noindex,follow'));
/* 试点后：11 个未充实页保持 noindex 且不进 sitemap；豆包页已补独有内容并单独开放索引 */
R.check(`B13a 工具页索引策略：11 个薄页仍 noindex,follow 且不在 sitemap；豆包页（已补 detail）可索引且在 sitemap`,
  toolsDirs.length === 12 && noindexed.length === 11 &&
  noindexed.every(d => !locs.includes(`${SITE}/tools/${d}/`)) &&
  !noindexed.includes('doubao') && locs.includes(`${SITE}/tools/doubao/`));
const HANDWRITTEN = ['index.html', 'cost/index.html', 'models/index.html', 'compare/index.html',
  'quiz/index.html', 'tools/index.html', 'prompts/index.html', 'about/index.html'];
R.check('B13b 静态注入标记区完好（模型卡片/工具分组/成本表/8 个手写页 FOOTER 标记）',
  read('models/index.html').includes('<!-- MODEL_CARDS_START -->') && read('models/index.html').includes('GLM-5.3-Flash') &&
  read('tools/index.html').includes('<!-- TOOL_GROUPS_START -->') && read('tools/index.html').includes('本站自研工具') &&
  read('cost/index.html').includes('<!-- COST_TABLE_START -->') && read('cost/index.html').includes('估算月成本') &&
  HANDWRITTEN.every(rel => read(rel).includes('<!-- FOOTER_START -->')));

R.summary();
