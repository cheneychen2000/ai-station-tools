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
  for (const u of curUrls) if (!base.pages[u]) diffs.push(`新增页面: ${u}`);
  for (const u of baseUrls) {
    if (!cur.pages[u]) continue;
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
  for (const rel of Object.keys(base.assets)) {
    if (!cur.assets[rel]) { if (!MIGRATED.has(rel)) diffs.push(`资产缺失: ${rel}`); }
    else if (cur.assets[rel] !== base.assets[rel]) diffs.push(`资产字节变化: ${rel}`);
  }
  for (const rel of Object.keys(cur.assets)) {
    if (!base.assets[rel] && !rel.startsWith('_astro/')) diffs.push(`新增资产: ${rel}`);
    /* _astro/ 为 Vite 打包产物（哈希文件名天然不稳定），属重构预期新增，不逐字节比对 */
  }
  if (diffs.length) {
    console.log(`REFACTOR DIFF: ${diffs.length} 处`);
    for (const d of diffs.slice(0, 60)) console.log('  ' + d);
    if (diffs.length > 60) console.log(`  …其余 ${diffs.length - 60} 处省略`);
    process.exit(1);
  }
  console.log(`REFACTOR OK: ${curUrls.length} 页面 SEO 语义一致，${Object.keys(cur.assets).length} 资产字节一致`);
} else {
  console.error('用法: node scripts/snapshot-site.mjs capture|compare <文件>');
  process.exit(2);
}
