/**
 * 页面级 SEO 校验：元数据、canonical 自引用、JSON-LD 可解析且无虚构结构、
 * 内部链接与图片可解析、noindex 与 sitemap 一致、列表页/成本表静态内容存在。
 * 全部基于 dist/ 实际 HTML 与数据文件运行。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { DIST, SITE, ROOT } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData } from './lib/manifest.mjs';
import { isSiteUrl } from './lib/escape.mjs';

const R = createReporter('check-seo-pages');
const { models, tools } = loadData();

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
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const strip = s => s.split('#')[0].split('?')[0];
const extOk = u => { try { return ['https:', 'http:'].includes(new URL(u).protocol); } catch (e) { return false; } };

let metaBad = [], canonBad = [], ldBad = [], linkBad = [], imgBad = [], noindexBad = [];
const titleSeen = new Map();

for (const file of pages) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const txt = readFileSync(file, 'utf8');
  const is404 = rel === '404.html';

  /* title / description / H1 */
  const title = (txt.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = (txt.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const h1Count = (txt.match(/<h1[ >]/g) || []).length;
  if (!title || !h1Count) metaBad.push(`${rel}（title/H1 缺失）`);
  if (!is404 && !desc) metaBad.push(`${rel}（description 缺失）`);
  if (title) {
    if (titleSeen.has(title)) metaBad.push(`${rel} 与 ${titleSeen.get(title)} 标题重复：${title}`);
    else titleSeen.set(title, rel);
  }

  /* canonical：每页一条、规范域名、指向本页（自引用） */
  const canonicals = [...txt.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(m => m[1]);
  if (!is404) {
    const selfUrl = SITE + '/' + rel.replace(/index\.html$/, '');
    if (canonicals.length !== 1) canonBad.push(`${rel}（canonical 数量=${canonicals.length}）`);
    else if (!isSiteUrl(canonicals[0], SITE)) canonBad.push(`${rel}（域名异常 ${canonicals[0]}）`);
    else if (canonicals[0] !== selfUrl) canonBad.push(`${rel}（非自引用：${canonicals[0]} ≠ ${selfUrl}）`);
  }

  /* JSON-LD：可解析、无虚构评分/评论、站内 URL 域名校验、FAQ 有可见正文 */
  for (const m of txt.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let o;
    try { o = JSON.parse(m[1]); } catch (e) { ldBad.push(`${rel}（JSON-LD 解析失败：${e.message}）`); continue; }
    if (/"@type"\s*:\s*"(AggregateRating|Review)"/.test(m[1])) ldBad.push(`${rel}（虚构评分/评论）`);
    for (const ld of Array.isArray(o) ? o : [o]) {
      if (ld.url && !isSiteUrl(ld.url, SITE)) ldBad.push(`${rel}（JSON-LD url 域名异常）`);
      if (ld['@type'] === 'BreadcrumbList') {
        for (const it of ld.itemListElement || []) if (!isSiteUrl(it.item, SITE)) ldBad.push(`${rel}（面包屑 URL 异常）`);
      }
      if (ld['@type'] === 'FAQPage') {
        for (const q of ld.mainEntity || []) if (!txt.includes(q.name)) ldBad.push(`${rel}（FAQ 无可见正文：${q.name}）`);
      }
      if (ld['@type'] === 'SoftwareApplication' && rel.startsWith('models/') && ld.offers) ldBad.push(`${rel}（模型页错误 Offer）`);
    }
  }

  /* 内部链接与外部链接（剔除 script 内容，避免把 JS 字符串拼接误当 HTML 链接） */
  const bodyNoScript = txt.replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of bodyNoScript.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:)?\/\//.test(href)) {
      if (href.startsWith('http') && !extOk(href)) linkBad.push(`${rel}（外链非法 ${href}）`);
      continue;
    }
    if (/^(#|javascript:|mailto:)/.test(href)) continue;
    const clean = strip(href);
    if (!clean) continue;
    const target = clean.startsWith('/') ? join(DIST, clean) : resolve(dirname(file), clean);
    const asFile = /[\\/]$/.test(clean) || !/\.[a-z0-9]+$/i.test(clean) ? join(target, 'index.html') : target;
    if (!existsSync(asFile) && !existsSync(target)) linkBad.push(`${rel}（死链 ${href}）`);
  }
  for (const m of bodyNoScript.matchAll(/<img\s[^>]*src="([^"]+)"/g)) {
    const src = strip(m[1]);
    if (/^https?:/.test(src)) continue;
    const target = src.startsWith('/') ? join(DIST, src) : resolve(dirname(file), src);
    if (!existsSync(target)) imgBad.push(`${rel}（图片缺失 ${m[1]}）`);
  }

  /* noindex 与 sitemap 一致 */
  if (/<meta name="robots" content="[^"]*noindex/.test(txt)) {
    const selfUrl = SITE + '/' + rel.replace(/index\.html$/, '');
    if (locs.includes(selfUrl)) noindexBad.push(rel);
  }
}

R.check(`P1 元数据完整且标题全站唯一（${pages.length} 页）`, metaBad.length === 0, metaBad.join(' | ') || 'title/desc/H1 全部合规');
R.check('P2 canonical 每页一条且自引用规范域名', canonBad.length === 0, canonBad.join(' | ') || '全部自引用');
R.check('P3 JSON-LD 全部可解析、无虚构结构、URL 域名一致、FAQ 有可见正文', ldBad.length === 0, ldBad.join(' | ') || '全部合规');
R.check('P4 内部链接与外链全部有效', linkBad.length === 0, linkBad.join(' | ') || '0 死链');
R.check('P5 本地图片资源全部存在', imgBad.length === 0, imgBad.join(' | ') || '0 缺失');
R.check('P6 noindex 页面均未进入 sitemap', noindexBad.length === 0, noindexBad.join(' | ') || '一致');

/* 核心静态内容：卡片与成本参考表直接存在于原始 HTML */
const modelsIndex = readFileSync(join(DIST, 'models/index.html'), 'utf8');
const toolsIndex = readFileSync(join(DIST, 'tools/index.html'), 'utf8');
const costHtml = readFileSync(join(DIST, 'cost/index.html'), 'utf8');
R.check('P7 /models/ 全部模型卡片静态存在', models.every(m => modelsIndex.includes(m.name)));
R.check('P7b /tools/ 全部工具卡片静态存在', tools.every(t => toolsIndex.includes(t.name)));
R.check('P7c /cost/ 静态参考表含全部模型名称与官方来源链接',
  models.every(m => costHtml.includes(m.name) && costHtml.includes(m.sourceUrl)));

/* 转义机制结构性断言：SEO 元数据插值必须经 esc()。
   迁移等价改写（提示词 §9.0）：旧断言读 scripts/build.mjs 的 page()，现读 Astro 布局组件的 headSeo 拼接。 */
const headSrc = readFileSync(join(ROOT, 'src/components/Layout.astro'), 'utf8');
R.check('P8 元数据插值经 esc() 转义（src/components/Layout.astro 的 headSeo）',
  headSrc.includes('<title>${esc(title)}</title>') && headSrc.includes('content="${esc(desc)}"'));

R.summary();
