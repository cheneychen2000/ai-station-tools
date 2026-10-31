/**
 * Markdown 内容体系专项校验（Phase 3）：
 *  C1  content-manifest 产物结构与来源（frontmatter 派生，路径与语言匹配）
 *  C2  中文/英文文章路由真实生成
 *  C3  草稿排除（draft=true 不产生任何生产 HTML）
 *  C4  无清单外文章页面（未发布/未登记的页面一律失败）
 *  C5  sitemap：indexable 文章收录且 lastmod = updatedAt；noindex 文章排除
 *  C6  canonical 自引用（文章页）
 *  C7  robots 与 indexable 一致
 *  C8  hreflang 与 translationKey 一致（有配对则双向输出，无配对则零输出）
 *  C9  目录（TOC）与正文标题一一对应且顺序一致
 *  C10 参考来源链接安全属性 + 站内链接可达（含相关文章）
 *  C11 指南首页收录已发布文章、不出现草稿
 *  C12 全站本地静态资源引用真实存在（script/link/img）
 * 运行：node scripts/check-content.mjs（在 build 之后执行）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData } from './lib/manifest.mjs';

const R = createReporter('check-content');
const read = rel => readFileSync(join(DIST, rel), 'utf8');

/* ---------- 源文件（frontmatter 轻量解析，仅用于草稿/清单一致性） ---------- */
const SRC = { 'zh-CN': 'src/content/guides/zh-CN', en: 'src/content/guides/en' };
function sourceArticles() {
  const out = [];
  for (const [lang, dir] of Object.entries(SRC)) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      const body = readFileSync(join(dir, name), 'utf8');
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body);
      const header = fm ? fm[1] : '';
      const draft = /^draft:\s*true\s*$/m.test(header);
      const indexable = !/^indexable:\s*false\s*$/m.test(header);
      out.push({ lang, slug: name.replace(/\.md$/, ''), draft, indexable, body });
    }
  }
  return out;
}
const sources = sourceArticles();

/* ---------- manifest ---------- */
const manifestPath = join(DIST, 'assets/data/content-manifest.json');
R.check('C1a content-manifest.json 产物存在（构建期由 frontmatter 派生）', existsSync(manifestPath));
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { articles: [] };
const articles = manifest.articles || [];
const shapeBad = articles.filter(a =>
  !['zh-CN', 'en'].includes(a.lang) ||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug || '') ||
  !/^\d{4}-\d{2}-\d{2}$/.test(a.lastmod || '') ||
  typeof a.indexable !== 'boolean' ||
  a.path !== (a.lang === 'en' ? `/en/guides/${a.slug}/` : `/guides/${a.slug}/`));
R.check(`C1b manifest 条目结构合法（${articles.length} 篇已发布文章：zh ${articles.filter(a => a.lang === 'zh-CN').length} / en ${articles.filter(a => a.lang === 'en').length}）`, shapeBad.length === 0, shapeBad.map(a => a.slug).join(', ') || '结构一致');

/* ---------- C2 路由 ---------- */
const pageOf = a => join(DIST, a.path.replace(/^\//, ''), 'index.html');
const missingPages = articles.filter(a => !existsSync(pageOf(a)));
R.check('C2 中/英 Markdown 文章均生成静态页面', missingPages.length === 0, missingPages.map(a => a.path).join(', ') || `${articles.length} 个页面全部存在`);

/* ---------- C3 草稿排除 ---------- */
const draftLeaks = sources.filter(s => s.draft).filter(s => {
  const path = s.lang === 'en' ? `en/guides/${s.slug}/index.html` : `guides/${s.slug}/index.html`;
  return existsSync(join(DIST, path)) || articles.some(a => a.slug === s.slug && a.lang === s.lang);
});
R.check(`C3 草稿（draft=true）不进入生产构建与清单（源 ${sources.filter(s => s.draft).length} 篇草稿，已发布 ${sources.filter(s => !s.draft).length} 篇）`,
  draftLeaks.length === 0, draftLeaks.map(s => `${s.lang}/${s.slug}`).join(', ') || '零泄漏');

/* ---------- C4 无清单外文章页面 ---------- */
const { pagesMeta } = loadData();
const staticGuideSlugs = new Set((pagesMeta.pages || [])
  .filter(p => p.path.startsWith('/guides/') && p.path !== '/guides/')
  .map(p => p.path.replace(/^\/guides\//, '').replace(/\/$/, ''))
  .concat((pagesMeta.pages || []).filter(p => p.en && p.en.startsWith('/en/guides/') && p.en !== '/en/guides/')
    .map(p => p.en.replace(/^\/en\/guides\//, '').replace(/\/$/, ''))));
function articleDirs(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter(name => {
    const p = join(root, name);
    return statSync(p).isDirectory() && existsSync(join(p, 'index.html'));
  });
}
const strayPages = [];
for (const [root, lang] of [[join(DIST, 'guides'), 'zh-CN'], [join(DIST, 'en/guides'), 'en']]) {
  for (const slug of articleDirs(root)) {
    if (staticGuideSlugs.has(slug)) continue; /* 既有 Astro 手写指南页 */
    if (!articles.some(a => a.lang === lang && a.slug === slug)) strayPages.push(`${lang}/${slug}`);
  }
}
R.check('C4 不存在清单外（未发布/未登记）的文章页面', strayPages.length === 0, strayPages.join(', ') || '全部来自已发布 Markdown');

/* ---------- C5 sitemap ---------- */
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const lastmodOf = loc => {
  const block = new RegExp(`<url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>\\s*(?:<lastmod>([^<]+)</lastmod>)?`).exec(sitemap);
  return block ? (block[1] || null) : null;
};
const indexableArticles = articles.filter(a => a.indexable);
const sitemapMissing = indexableArticles.filter(a => !locs.includes(SITE + a.path));
const lastmodBad = indexableArticles.filter(a => lastmodOf(SITE + a.path) !== a.lastmod);
const noindexInSitemap = articles.filter(a => !a.indexable).filter(a => locs.includes(SITE + a.path));
R.check(`C5a sitemap 收录全部 indexable 文章（${indexableArticles.length} 篇）`, sitemapMissing.length === 0, sitemapMissing.map(a => a.path).join(', ') || '全部收录');
R.check('C5b 文章 lastmod = frontmatter updatedAt（非构建日期）', lastmodBad.length === 0, lastmodBad.map(a => `${a.path} 期望 ${a.lastmod} 实际 ${lastmodOf(SITE + a.path)}`).join(' | ') || '全部一致');
R.check('C5c indexable=false 文章不进 sitemap', noindexInSitemap.length === 0, noindexInSitemap.map(a => a.path).join(', ') || '零违规');

/* ---------- C6/C7 canonical 与 robots ---------- */
const seoBad = [];
for (const a of articles) {
  const html = readFileSync(pageOf(a), 'utf8');
  const canonical = /<link rel="canonical" href="([^"]+)">/.exec(html)?.[1];
  if (canonical !== SITE + a.path) seoBad.push(`${a.path} canonical=${canonical}`);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  if (a.indexable && noindex) seoBad.push(`${a.path} 可索引文章却输出 noindex`);
  if (!a.indexable && !noindex) seoBad.push(`${a.path} noindex 文章缺少 robots`);
  if (!/<h1[ >]/.test(html)) seoBad.push(`${a.path} 缺 H1`);
  const ldCount = (html.match(/<script type="application\/ld\+json">/g) || []).length;
  if (ldCount < 2) seoBad.push(`${a.path} JSON-LD 数量=${ldCount}（应含 Article + BreadcrumbList）`);
}
R.check('C6/C7 文章页 canonical 自引用、H1/JSON-LD 齐全、robots 与 indexable 一致', seoBad.length === 0, seoBad.slice(0, 5).join(' | ') || '全部合规');

/* ---------- C8 hreflang 与 translationKey ---------- */
const pairs = new Map();
for (const a of articles) {
  if (!a.translationKey) continue;
  const cur = pairs.get(a.translationKey) || {};
  cur[a.lang] = a;
  pairs.set(a.translationKey, cur);
}
const hreflangBad = [];
for (const a of articles) {
  const html = readFileSync(pageOf(a), 'utf8');
  const hrefs = [...html.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(m => `${m[1]}=${m[2]}`);
  const pair = a.translationKey ? pairs.get(a.translationKey) : null;
  const hasBoth = Boolean(pair && pair['zh-CN'] && pair.en);
  if (hasBoth) {
    const want = ['zh-CN=' + SITE + pair['zh-CN'].path, 'en=' + SITE + pair.en.path];
    if (hrefs.length !== 2 || want.some(w => !hrefs.includes(w))) hreflangBad.push(`${a.path} 期望双向 hreflang，实际 ${JSON.stringify(hrefs)}`);
    if (a.indexable === false && !pair.en.indexable && hrefs.length) hreflangBad.push(`${a.path} noindex 文章不应输出 hreflang`);
  } else if (hrefs.length !== 0) {
    hreflangBad.push(`${a.path} 无配对却输出 hreflang：${JSON.stringify(hrefs)}`);
  }
}
R.check(`C8 hreflang 与 translationKey 一致（配对 ${[...pairs.values()].filter(v => v['zh-CN'] && v.en).length} 组）`, hreflangBad.length === 0, hreflangBad.slice(0, 5).join(' | ') || '全部一致');

/* ---------- C9 目录与正文标题一致 ---------- */
const tocBad = [];
for (const a of articles) {
  const html = readFileSync(pageOf(a), 'utf8');
  const tocBlock = /<nav class="article-toc"[\s\S]*?<\/nav>/.exec(html)?.[0] || '';
  const tocHrefs = [...tocBlock.matchAll(/href="#([^"]+)"/g)].map(m => decodeURIComponent(m[1]));
  const bodyIds = [...html.matchAll(/<h([23]) id="([^"]+)"/g)].map(m => decodeURIComponent(m[2]));
  if (bodyIds.length === 0) continue; /* 文章可以没有小标题 */
  if (tocHrefs.length === 0) { tocBad.push(`${a.path} 有 H2/H3 但无目录`); continue; }
  if (tocHrefs.join('|') !== bodyIds.join('|')) tocBad.push(`${a.path} 目录与正文标题不一致`);
}
R.check('C9 目录只收 H2/H3、锚点与正文 id 完全一致且顺序相同', tocBad.length === 0, tocBad.slice(0, 5).join(' | ') || '全部一致');

/* ---------- C10 来源与站内链接 ---------- */
const linkBad = [];
const localRefs = [];
for (const a of articles) {
  const html = readFileSync(pageOf(a), 'utf8');
  const file = pageOf(a);
  const src = sources.find(s => s.lang === a.lang && s.slug === a.slug);
  const hasSourcesFrontmatter = src ? /^sources:/m.test(src.body) : false;
  if (hasSourcesFrontmatter) {
    const refs = [...html.matchAll(/<section class="panel" aria-label="[^"]*(?:参考资料|References)[^"]*"[\s\S]*?<\/section>/g)];
    if (!refs.length) linkBad.push(`${a.path} frontmatter 有 sources 但页面无参考资料区`);
  }
  /* 外链安全属性 */
  for (const m of html.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)) {
    const tag = m[0];
    if (!/rel="[^"]*noopener/.test(tag)) linkBad.push(`${a.path} 外链缺 rel=noopener：${m[1]}`);
  }
  /* 站内链接可达（面包屑 / 相关文章 / 正文内链） */
  for (const m of html.matchAll(/<a [^>]*href="((?:\.\.\/|\.\/|\/)[^"#]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    const target = href.startsWith('/')
      ? join(DIST, href.replace(/^\//, ''), href.endsWith('/') || !/\.[a-z0-9]+$/i.test(href) ? 'index.html' : '')
      : resolve(dirname(file), href, href.endsWith('/') ? 'index.html' : '');
    localRefs.push({ from: a.path, href, target });
  }
}
const brokenLocal = localRefs.filter(r => !existsSync(r.target));
R.check('C10a 文章页外链均带 rel=noopener，有 sources 的文章渲染参考资料区', linkBad.length === 0, linkBad.slice(0, 5).join(' | ') || '全部合规');
R.check(`C10b 文章页站内链接（面包屑/相关文章/正文内链，${localRefs.length} 条）全部可达`, brokenLocal.length === 0,
  brokenLocal.slice(0, 5).map(r => `${r.from} → ${r.href}`).join(' | ') || '零死链');

/* ---------- C11 指南首页收录 ---------- */
const indexBad = [];
for (const lang of ['zh-CN', 'en']) {
  const listFile = lang === 'en' ? 'en/guides/index.html' : 'guides/index.html';
  const html = read(listFile);
  for (const a of articles.filter(x => x.lang === lang)) {
    if (!html.includes(`href="${a.slug}/"`)) indexBad.push(`${listFile} 缺文章入口 ${a.slug}`);
  }
  for (const s of sources.filter(x => x.draft && x.lang === lang)) {
    if (html.includes(`href="${s.slug}/"`)) indexBad.push(`${listFile} 出现草稿链接 ${s.slug}`);
  }
}
R.check('C11 指南首页收录全部已发布文章，且不出现草稿入口', indexBad.length === 0, indexBad.slice(0, 5).join(' | ') || '全部正确');

/* ---------- C12 全站本地静态资源引用可达 ---------- */
function allHtml(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(p).isDirectory()) out.push(...allHtml(p, rel));
    else if (name.endsWith('.html')) out.push(rel);
  }
  return out;
}
const assetBad = [];
for (const rel of allHtml(DIST)) {
  const html = readFileSync(join(DIST, rel), 'utf8');
  const refs = [
    ...html.matchAll(/<script [^>]*src="([^"]+)"/g),
    ...html.matchAll(/<link [^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
    ...html.matchAll(/<link [^>]*rel="icon"[^>]*href="([^"]+)"/g),
    ...html.matchAll(/<img [^>]*src="([^"]+)"/g)
  ].map(m => m[1]).filter(h => !/^(https?:)?\/\//.test(h) && !h.startsWith('data:'));
  for (const href of refs) {
    const target = href.startsWith('/')
      ? join(DIST, href.replace(/^\//, ''))
      : resolve(dirname(join(DIST, rel)), href);
    if (!existsSync(target)) assetBad.push(`${rel} → ${href}`);
  }
}
R.check('C12 全站本地脚本/样式/图标/图片引用均真实存在（无 404 资产）', assetBad.length === 0, assetBad.slice(0, 8).join(' | ') || '零缺失');

R.summary();
