/**
 * 顺序运行全部既有检查脚本并汇总退出码（迁移基线留档 / 迁移后回归共用）。
 * 用法：node scripts/run-checks.mjs [--build]
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/paths.mjs';

const SCRIPTS = [
  ['build', 'scripts/build.mjs'],
  ['selftest', 'scripts/selftest.mjs'],
  ['test-pricing', 'scripts/test-pricing.mjs'],
  ['check-content', 'scripts/check-content.mjs'],
  ['check-seo-pages', 'scripts/check-seo-pages.mjs'],
  ['check-en-pages', 'scripts/check-en-pages.mjs'],
  ['check-i18n', 'scripts/check-i18n.mjs'],
  ['check-inline-js', 'scripts/check-inline-js.mjs'],
  ['check-emoji', 'scripts/check-emoji.mjs'],
  ['check-domain', 'scripts/check-domain.mjs'],
  ['check-brand', 'scripts/check-brand.mjs'],
  ['check-nav', 'scripts/check-nav.mjs'],
  ['check-sitemap-lastmod', 'scripts/check-sitemap-lastmod.mjs'],
  ['audit-indexing', 'scripts/audit-indexing.mjs'],
  ['audit-tool-pages', 'scripts/audit-tool-pages.mjs'],
  ['audit-compare-pages', 'scripts/audit-compare-pages.mjs'],
  ['check-affiliates', 'scripts/check-affiliates.mjs'],
  ['test-placement-transitions', 'scripts/test-placement-transitions.mjs'],
  ['check-build', 'scripts/check-build.mjs'],
  ['check-prompts', 'scripts/check-prompts.mjs']
];

const only = process.argv[2];
let failed = 0;
for (const [name, rel] of SCRIPTS) {
  if (only && only !== '--build' && !name.includes(only)) continue;
  const t0 = Date.now();
  let out = '';
  let ok = true;
  try {
    out = execFileSync(process.execPath, [join(ROOT, rel)], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const ms = Date.now() - t0;
  const lines = out.trim().split('\n');
  console.log(`\n### ${name}  ${ok ? 'OK' : 'FAIL'}  ${ms}ms`);
  console.log(lines.slice(-14).join('\n'));
  if (!ok) failed++;
}
console.log('\n' + (failed ? `FAILED ${failed} script(s)` : 'ALL SCRIPTS PASSED'));
process.exit(failed ? 1 : 0);
