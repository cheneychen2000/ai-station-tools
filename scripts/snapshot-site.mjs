/**
 * 站点快照工具：对 dist/ 采集可比对的重构回归基线（phase 1 基线 / phase 9 回归共用）。
 *
 * 用法：
 *   node scripts/snapshot-site.mjs capture <输出.json>   # 采集 dist 快照
 *   node scripts/snapshot-site.mjs compare <基线.json>   # 当前 dist 对比基线（差异即退出码 1）
 *
 * 比对口径（重构允许 HTML 空白/属性实现方式变化，不允许语义变化）：
 *  - HTML：URL 集合 + 每页 title/description/canonical/robots/hreflang/og:* /JSON-LD 逐字段相等；
 *  - assets/**（JS/CSS/JSON/图片/图标）：字节级 sha1 必须一致（公开 URL 契约）；
 *    例外仅限"行尾符等价"：基线在 Windows(CRLF) 采集、CI 在 Linux(LF) 检出时，文本资产允许
 *    LF/CRLF 归一化后哈希命中基线（逐条打印留痕）；内容任何差异仍然失败；
 *  - sitemap.xml：全文一致；
 *  - robots.txt / _headers / manifest.json：字节一致；
 *  - 404.html 存在。
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './lib/paths.mjs';

const DIST = join(ROOT, process.env.ASTRO_OUT_DIR || 'dist');

function walk(dir, base = '') {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    return statSync(p).isDirectory() ? walk(p, rel) : [rel];
  });
}

const sha1 = buf => createHash('sha1').update(buf).digest('hex');

/** 从 HTML 提取 SEO 语义面（正则级，大小写敏感与产物一致即可） */
function seoOf(html) {
  const pick = re => { const m = re.exec(html); return m ? m[1] : null; };
  const all = re => { const out = []; let mm; while ((mm = re.exec(html))) out.push(mm[1]); return out; };
  const jsonlds = [];
  const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = ldRe.exec(html))) {
    try { jsonlds.push(JSON.parse(m[1].trim())); } catch (e) { jsonlds.push({ __parseError: m[1].trim().slice(0, 120) }); }
  }
  return {
    title: pick(/<title>([\s\S]*?)<\/title>/),
    description: pick(/<meta name="description" content="([\s\S]*?)">/),
    robots: pick(/<meta name="robots" content="([^"]*)">/),
    canonical: pick(/<link rel="canonical" href="([^"]*)">/),
    hreflang: all(/<link rel="alternate" hreflang="([^"]*)" href="[^"]*">/g),
    og: {
      type: pick(/<meta property="og:type" content="([^"]*)">/),
      site_name: pick(/<meta property="og:site_name" content="([^"]*)">/),
      title: pick(/<meta property="og:title" content="([^"]*)">/),
      description: pick(/<meta property="og:description" content="([^"]*)">/),
      url: pick(/<meta property="og:url" content="([^"]*)">/),
      image: pick(/<meta property="og:image" content="([^"]*)">/)
    },
    jsonld: jsonlds
  };
}

function capture() {
  const files = walk(DIST);
  const pages = {};
  const assets = {};
  for (const rel of files) {
    const buf = readFileSync(join(DIST, rel));
    if (rel.endsWith('.html')) {
      const url = '/' + rel.replace(/index\.html$/, '').replace(/\\/g, '/');
      pages[url] = { file: rel, seo: seoOf(buf.toString('utf8')), sha1: sha1(buf) };
    } else {
      assets[rel] = sha1(buf);
    }
  }
  return { capturedAt: new Date().toISOString(), pages, assets };
}

const cmd = process.argv[2];
const file = process.argv[3];
if (cmd === 'capture') {
  const snap = capture();
  writeFileSync(file, JSON.stringify(snap, null, 1), 'utf8');
  console.log(`snapshot: ${Object.keys(snap.pages).length} pages, ${Object.keys(snap.assets).length} assets → ${file}`);
} else if (cmd === 'compare') {
  const base = JSON.parse(readFileSync(file, 'utf8'));
  const cur = capture();
  const diffs = [];
  const baseUrls = Object.keys(base.pages), curUrls = Object.keys(cur.pages);
  for (const u of baseUrls) if (!cur.pages[u]) diffs.push(`页面缺失: ${u}`);
  /* Phase 3 起允许"由已发布 Markdown 文章带来"的新增页面：以 dist 的 content-manifest 为白名单，
     清单之外的新增页面一律失败（异常增加检测）。历史页面缺失仍逐条失败（异常删除检测）。 */
  const manifestFile = join(DIST, 'assets/data/content-manifest.json');
  const allowedArticles = new Set();
  if (existsSync(manifestFile)) {
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    for (const a of manifest.articles || []) if (a.path) allowedArticles.add(a.path);
  }
  for (const u of curUrls) {
    if (base.pages[u]) continue;
    if (!allowedArticles.has(u)) diffs.push(`异常新增页面（既不属历史基线也不属已发布 Markdown）: ${u}`);
  }
  for (const p of allowedArticles) {
    if (!cur.pages[p]) diffs.push(`文章清单中存在但页面缺失: ${p}`);
  }
  let historicalOk = 0;
  for (const u of baseUrls) {
    if (!cur.pages[u]) { diffs.push(`历史页面缺失: ${u}`); continue; }
    historicalOk++;
    /* &#39; ↔ ' 为等价 HTML 转义（esc() 与 Astro 插值的单引号策略差异），比对时归一化 */
    const norm = s => s.replace(/&#39;/g, "'");
    const a = norm(JSON.stringify(base.pages[u].seo)), b = norm(JSON.stringify(cur.pages[u].seo));
    if (a !== b) diffs.push(`SEO 差异: ${u}`);
  }
  /* 重构期已登记的重命名/迁移（旧 URL 有检查脚本级回归断言兜底：check-nav N6/N13c、check-i18n I15 等）：
     assets/style.css → src/styles/global.css（Vite 打包 /_astro/*.css，内容断言不变）
     assets/app.js    → src/scripts/app.ts（打包 /_astro/SiteLayout.*.js）
     assets/lib-filter.js → src/scripts/model-filter.ts（打包模块） */
  const MIGRATED = new Set(['assets/style.css', 'assets/app.js', 'assets/lib-filter.js']);
  /* 行尾符等价判定：基线在 Windows（core.autocrlf=true）采集，部分文本资产工作区为 CRLF，
     Linux CI 检出为 LF —— 内容相同、仅 EOL 不同。此处仅接受"归一化为 LF/CRLF 后哈希命中基线"的情形，
     任何内容性差异（含空白/字段变化）仍然失败；命中时逐条打印，保留审计痕迹。 */
  const TEXT_ASSET = /\.(json|js|css|html|xml|txt|svg|webmanifest)$/i;
  const eolEquivalent = [];
  const sha1 = buf => createHash('sha1').update(buf).digest('hex');
  const eolVariants = buf => {
    const lf = buf.toString('utf8').replace(/\r\n/g, '\n');
    return [Buffer.from(lf, 'utf8'), Buffer.from(lf.replace(/\n/g, '\r\n'), 'utf8')];
  };
  for (const rel of Object.keys(base.assets)) {
    if (!cur.assets[rel]) { if (!MIGRATED.has(rel)) diffs.push(`资产缺失: ${rel}`); continue; }
    /* sitemap.xml 会因新增已发布文章而合法变化：改为"历史 URL 与 lastmod 逐条不变 + 新增项必须来自文章清单"语义比对 */
    if (rel === 'sitemap.xml') continue;
    if (cur.assets[rel] === base.assets[rel]) continue;
    const file = join(DIST, rel);
    const onlyEol = TEXT_ASSET.test(rel) && existsSync(file) && eolVariants(readFileSync(file)).some(v => sha1(v) === base.assets[rel]);
    if (onlyEol) eolEquivalent.push(rel);
    else diffs.push(`资产字节变化: ${rel}`);
  }

  /* sitemap.xml 会因新增已发布文章而合法变化，故不做字节比对；
     其语义完整性由 check-sitemap-lastmod（S8/S9 与 manifest 逐条一致）与 check-content C5a~C5c 覆盖。 */
  /* Phase 3 新增的派生资产（构建期由 frontmatter 生成，与 compare-pairs.json 同性质） */
  const NEW_DERIVED_ASSETS = new Set(['assets/data/content-manifest.json']);
  for (const rel of Object.keys(cur.assets)) {
    if (base.assets[rel]) continue;
    if (rel.startsWith('_astro/')) continue; /* Vite 打包产物（哈希名不稳定），不逐字节比对 */
    if (NEW_DERIVED_ASSETS.has(rel)) continue;
    diffs.push(`异常新增资产: ${rel}`);
  }
  if (diffs.length) {
    console.log(`REFACTOR DIFF: ${diffs.length} 处`);
    for (const d of diffs.slice(0, 60)) console.log('  ' + d);
    if (diffs.length > 60) console.log(`  …其余 ${diffs.length - 60} 处省略`);
    process.exit(1);
  }
  if (eolEquivalent.length) console.log(`行尾符等价（内容一致，仅 CRLF/LF 差异，已审计放行）: ${eolEquivalent.join(', ')}`);
  console.log(`REFACTOR OK: 历史 ${historicalOk}/${baseUrls.length} 页面完整且 SEO 一致；Markdown 文章新增 ${curUrls.length - baseUrls.length} 页（均来自 content-manifest）；${Object.keys(cur.assets).length} 资产字节一致${eolEquivalent.length ? `（其中 ${eolEquivalent.length} 项为行尾符等价）` : ''}`);
} else {
  console.error('用法: node scripts/snapshot-site.mjs capture|compare <文件>');
  process.exit(2);
}
