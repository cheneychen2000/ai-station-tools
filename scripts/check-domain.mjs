/** 域名一致性核查：全站 canonical / og:url / sitemap / robots 必须统一为 https://www.reflex-hub.com（URL 解析比对 origin，非字符串前缀） */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { isSiteUrl } from './lib/escape.mjs';

const R = createReporter('check-domain');

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else out.push(p);
  }
  return out;
}

let violations = [];
let canonicalCount = 0;
let ogCount = 0;

for (const p of walk(DIST)) {
  const txt = readFileSync(p, 'utf8');
  if (p.endsWith('.html')) {
    const canonicals = [...txt.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(m => m[1]);
    const ogs = [...txt.matchAll(/<meta property="og:url" content="([^"]+)"/g)].map(m => m[1]);
    canonicalCount += canonicals.length;
    ogCount += ogs.length;
    for (const u of [...canonicals, ...ogs]) {
      /* 用 URL 解析比对 origin：www.reflex-hub.com.evil.example 这类前缀欺骗不能通过 */
      if (!isSiteUrl(u, SITE)) violations.push(p.replace(DIST, '') + ' → ' + u);
    }
  }
}
R.check(`canonical ${canonicalCount} 条 + og:url ${ogCount} 条域名全部一致`, violations.length === 0, violations.join(' | ') || '0 违规');

const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const badLocs = locs.filter(u => !isSiteUrl(u, SITE));
R.check(`sitemap loc ${locs.length} 条域名全部一致`, badLocs.length === 0, badLocs.join(' | ') || '0 违规');

const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
R.check('robots.txt Sitemap 行域名一致', robots.includes(`Sitemap: ${SITE}/sitemap.xml`));

const lastmods = [...new Set([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]))];
R.pass('sitemap lastmod 取值（数据/内容真实更新日期，由 manifest 规则驱动）', lastmods.join(', ') || '（全部省略）');

R.summary();
