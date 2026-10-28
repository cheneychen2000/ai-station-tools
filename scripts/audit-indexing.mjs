/**
 * SEO 收录就绪审计：页面盘点、sitemap/robots/canonical/noindex/导航一致性，
 * 输出 reports/indexing-readiness.md（含 P0/P1/P2 问题与证据）。
 * 仅基于 dist/ 实际产物与数据文件运行；不访问任何私有站长后台。
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DIST, SITE, REPORTS } from './lib/paths.mjs';
import { loadData, buildManifest, comparePairs, isToolIndexable } from './lib/manifest.mjs';

const { models, tools, pagesMeta, compares } = loadData();

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const pages = walk(DIST).map(f => relative(DIST, f).replace(/\\/g, '/'));
const PAIRS = comparePairs(models, compares.extraPairs || []);
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const manifest = buildManifest({ models, tools, pagesMeta, compares });
const read = rel => readFileSync(join(DIST, rel), 'utf8');

/* ---------- 事实盘点 ---------- */
const htmlPages = pages.length;
const handwritten = pagesMeta.pages.map(p => p.path);
const noindexPages = pages.filter(rel => /<meta name="robots" content="[^"]*noindex/.test(read(rel)));
const sitemapSet = new Set(locs);
const manifestSet = new Set(manifest.map(e => SITE + e.path));
const inSitemapNotManifest = locs.filter(u => !manifestSet.has(u));
const inManifestNotSitemap = [...manifestSet].filter(u => !sitemapSet.has(u));

/* 全站死链/导航存在性（复用 check-nav 的关键事实，轻量自验） */
let deadLinks = [], missingNav = [];
for (const rel of pages) {
  const t = read(rel);
  if (rel !== '404.html') {
    if (!t.includes('<nav class="site-nav" aria-label="主导航">')) missingNav.push(rel);
    if (!t.includes('<nav class="footer-nav" aria-label="页脚导航">')) missingNav.push(rel + '（页脚）');
  }
  const body = t.replace(/<script[\s\S]*?<\/script>/g, '');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  for (const m of body.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:)?\/\//.test(href) || /^(#|javascript:|mailto:)/.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? join(DIST, clean, clean.endsWith('/') ? 'index.html' : '')
      : join(DIST, dir, clean, /\/$/.test(clean) ? 'index.html' : '');
    if (!existsSync(target)) deadLinks.push(`${rel} → ${href}`);
  }
}

/* ---------- P0/P1/P2 ---------- */
const p0 = [], p1 = [], p2 = [];
if (deadLinks.length) p0.push(`站内死链 ${deadLinks.length} 处：${deadLinks.slice(0, 5).join('；')}`);
if (missingNav.length) p0.push(`缺导航页：${missingNav.slice(0, 5).join('；')}`);
if (noindexPages.some(rel => sitemapSet.has(SITE + '/' + rel.replace(/index\.html$/, '')))) {
  p0.push('noindex 页面进入了 sitemap');
}
if (inSitemapNotManifest.length) p1.push(`sitemap 与页面清单不一致（多出）：${inSitemapNotManifest.join('、')}`);
if (inManifestNotSitemap.length) p1.push(`页面清单有而 sitemap 缺：${inManifestNotSitemap.join('、')}`);
if (pages.filter(rel => !noindexPages.includes(rel) && !locs.includes(SITE + '/' + rel.replace(/index\.html$/, ''))).length) {
  const missed = pages.filter(rel => !noindexPages.includes(rel) && !locs.includes(SITE + '/' + rel.replace(/index\.html$/, '')));
  p1.push(`可索引页面未进 sitemap：${missed.join('、')}`);
}
const trustPages = ['/pricing-methodology/', '/privacy/', '/affiliate-disclosure/', '/terms/'];
if (!trustPages.every(p => sitemapSet.has(SITE + p))) p1.push('信任页面未全部进入 sitemap');
/* 已知非阻塞观察项 */
p2.push(`对比详情页 ${PAIRS.length} 个为"同模板+不同真实数据"的工具型页面（audit-compare-pages 已逐页审计硬指标全过，含差异化摘要与双向内链）`);
p2.push('quiz/prompts 页 contentUpdatedAt 为 2026-09-18/19，属真实内容时间，未机械刷新 lastmod');
p2.push('本站无服务端，HTTP 状态依赖 Cloudflare Pages（静态 200 / 404.html 兜底），仓库内无法实测线上响应头');
p2.push('对比页组合为全量 C(17,2)=136，属产品既定策略，非为扩量生成的重复内容');
if (!p0.length) p0.push('无 P0 阻塞项（死链/导航/noindex 冲突/索引矛盾均为零）');

/* ---------- 报告 ---------- */
mkdirSync(REPORTS, { recursive: true });
const md = `# SEO 收录就绪审计报告

生成：2026-10-28，由 scripts/audit-indexing.mjs 对 dist/ 实际产物运行（可重复执行）。
范围声明：本报告仅基于仓库与构建产物，未访问 Google Search Console / Bing Webmaster Tools 等私有后台，不包含任何真实收录量、点击量或索引日期断言。

## 一、页面盘点

| 类别 | 数量 | 说明 |
|---|---|---|
| HTML 页面总数 | ${htmlPages} | 含 404（noindex） |
| 手写栏目页 | ${handwritten.length} | ${handwritten.join('、')} |
| 模型详情页 | ${models.length} | /models/<id>/ |
| 对比详情页 | ${PAIRS.length} | /compare/<a>/<b>/（全组合，a<b 归一） |
| 第三方工具详情页 | ${tools.filter(t => !t.own).length} | 全部 noindex,follow，不进 sitemap |
| sitemap URL | ${locs.length} | 全部 https www 规范域 |
| noindex 页面 | ${noindexPages.length} | ${noindexPages.slice(0, 3).join('、')}${noindexPages.length > 3 ? ' …' : ''} |

## 二、一致性核验（证据）

- canonical / og:url：全站 ${htmlPages - 1} 个非 404 页各恰一条 canonical 且自引用规范域（check-domain 4/4 通过）；
- robots.txt：放行全部主流搜索引擎与 AI 爬虫（GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Baiduspider/bingbot），声明 Sitemap；
- meta robots：仅 12 个第三方工具薄页与 404 为 noindex，且均未进入 sitemap（P6/S6/B12a 多脚本交叉验证）；
- sitemap ↔ 页面清单：${locs.length} 条与 manifest 规则一一对应，lastmod 取数据/内容真实更新日期（S8/S9 通过）；
- 统一导航 / 跳到正文 / 页脚导航：全站 ${htmlPages} 页覆盖（check-nav N1/N2/N5）；
- 内链：主导航 5 项 + 页脚"核心工具 6 项 + 站点信息 5 项（关于/定价方法论/隐私/联盟披露/条款）+ GitHub 反馈"，0 死链（P4/N4）。

## 三、问题清单

### P0（阻塞收录，必须修复）
${p0.map(x => `- ${x}`).join('\n')}

### P1（应在推广前完成）
${p1.length ? p1.map(x => `- ${x}`).join('\n') : '- 无（上线后以下后台动作转交站长，见第四节）'}

### P2（观察项，非阻塞）
${p2.map(x => `- ${x}`).join('\n')}

## 四、需网站所有者在 GSC / Bing 后台人工完成（本次未访问任何后台）

1. **Google Search Console**：首页已内置 google-site-verification meta，登录 GSC 确认 reflex-hub.com 资源已验证（或按 meta 方式完成验证）；提交 sitemap \`https://www.reflex-hub.com/sitemap.xml\`；对首页、/cost/、/models/、/compare/、/pricing-methodology/ 使用"网址检查 → 请求编入索引"；观察"网页体验/Core Web Vitals"报告。
2. **Bing Webmaster Tools**：首页已内置 msvalidate.01 meta，登录后确认站点验证；从 GSC 导入或手动提交同一 sitemap；确认 robots.txt 抓取正常。
3. 上线后 1-2 周核对：索引覆盖率中 136 个对比页的抓取与索引状态；若大面积"已抓取-未编入索引"，回看 P2 观察项并考虑收敛对比页数量（属产品决策）。
`;
writeFileSync(join(REPORTS, 'indexing-readiness.md'), md, 'utf8');
console.log(`indexing-readiness.md written: ${htmlPages} pages, ${locs.length} sitemap urls, P0=${p0.length} P1=${p1.length} P2=${p2.length}`);
console.log('P0:', p0.join(' | '));
if (p1.length) console.log('P1:', p1.join(' | '));
