/**
 * sitemap 专项校验：XML 结构、URL 去重、规范域名、页面真实存在、noindex 排除、
 * lastmod 与 manifest 规则逐条一致（规则见 scripts/lib/manifest.mjs，禁止构建日期）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, buildManifest } from './lib/manifest.mjs';
import { isSiteUrl } from './lib/escape.mjs';

const R = createReporter('check-sitemap-lastmod');
const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');

/* XML 结构（零依赖：结构化标签配对检查） */
R.check('S1 XML 声明与 urlset 根元素配对',
  xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
  /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(xml) &&
  xml.trimEnd().endsWith('</urlset>'));
const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => m[1]);
R.check('S2 每个 <url> 含且仅含一个 <loc>，lastmod 至多一个',
  urlBlocks.every(b => (b.match(/<loc>/g) || []).length === 1 && (b.match(/<lastmod>/g) || []).length <= 1));
const locs = urlBlocks.map(b => /<loc>([^<]+)<\/loc>/.exec(b)[1]);
R.check(`S3 URL 无重复（${locs.length} 条）`, new Set(locs).size === locs.length);
R.check('S4 全部为规范 www HTTPS 域名', locs.every(u => isSiteUrl(u, SITE) && new URL(u).protocol === 'https:'));

/* URL → 本地文件映射：路径须真实存在且对应 HTML 页面 */
function urlToFile(u) {
  const path = new URL(u).pathname;
  return join(DIST, path.replace(/^\//, ''), path.endsWith('/') ? 'index.html' : '');
}
const missing = locs.filter(u => !existsSync(urlToFile(u)));
R.check('S5 全部 URL 对应真实存在的页面', missing.length === 0, missing.join(' | ') || '0 缺失');

/* noindex 页面不得进入 sitemap；404 不得进入 */
const noindexed = locs.filter(u => /<meta name="robots" content="[^"]*noindex/.test(readFileSync(urlToFile(u), 'utf8')));
R.check('S6 noindex 页面未被收录', noindexed.length === 0, noindexed.join(' | ') || '0 违规');
R.check('S7 不含 404/测试页', locs.every(u => !/404|test|demo/i.test(new URL(u).pathname)));

/* lastmod：与 manifest 规则逐条一致（路径集合 + 每条日期）
   Phase 3 起 manifest 还要包含已发布且 indexable 的 Markdown 文章（lastmod = updatedAt，来自 content-manifest 产物） */
const data = loadData();
const contentManifestPath = join(DIST, 'assets/data/content-manifest.json');
const contentManifest = existsSync(contentManifestPath) ? JSON.parse(readFileSync(contentManifestPath, 'utf8')) : { articles: [] };
const articleEntries = (contentManifest.articles || [])
  .filter(a => a.indexable)
  .map(a => ({ path: a.path, lastmod: a.lastmod }));
const manifest = buildManifest({ ...data, articles: articleEntries });
const xmlEntries = urlBlocks.map(b => ({
  loc: /<loc>([^<]+)<\/loc>/.exec(b)[1],
  lastmod: (b.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || null
}));
R.check('S8 sitemap 与页面清单一一对应（新增/下线页面同步）',
  locs.length === manifest.length && manifest.every(e => locs.includes(SITE + e.path)));
let dateBad = [];
for (const e of manifest) {
  const got = (xmlEntries.find(x => x.loc === SITE + e.path) || {}).lastmod || null;
  if (got !== e.lastmod) dateBad.push(`${e.path}: 期望 ${e.lastmod} 实际 ${got}`);
}
R.check('S9 lastmod 逐条等于数据/内容真实更新日期（非构建日期）', dateBad.length === 0, dateBad.join(' | ') || '全部一致');
R.check('S10 lastmod 均为合法 YYYY-MM-DD 或不填写',
  xmlEntries.every(x => x.lastmod === null || (/^\d{4}-\d{2}-\d{2}$/.test(x.lastmod) && !isNaN(Date.parse(x.lastmod)))));

R.summary();
