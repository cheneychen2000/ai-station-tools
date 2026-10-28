/**
 * 工具详情页索引审核：第三方薄页默认 noindex,follow 并移出 sitemap；
 * 审核结论逐页写入 reports/tool-page-audit.md（含恢复索引的条件）。
 * 自研工具不生成详情页（功能模块本身即内容页，正常索引）。
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, REPORTS } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, isToolIndexable } from './lib/manifest.mjs';

const R = createReporter('audit-tool-pages');
const { tools } = loadData();
const extTools = tools.filter(t => !t.own);
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const rows = [];
let bad = 0;

for (const t of extTools) {
  const file = join(DIST, 'tools', t.id, 'index.html');
  const url = `${SITE}/tools/${t.id}/`;
  const indexable = isToolIndexable(t);
  const problems = [];
  if (!existsSync(file)) {
    problems.push('页面缺失');
  } else {
    const txt = readFileSync(file, 'utf8');
    const noindex = txt.includes('<meta name="robots" content="noindex,follow">');
    if (indexable && noindex) problems.push('已开放索引但仍带 noindex');
    if (!indexable && !noindex) problems.push('薄页缺少 noindex,follow');
    if (!indexable && sitemap.includes(url)) problems.push('noindex 页面误入 sitemap');
    if (indexable && !sitemap.includes(url)) problems.push('可索引页面未进 sitemap');
    if (!txt.includes(`<link rel="canonical" href="${url}">`)) problems.push('canonical 非自引用');
    if (!txt.includes(t.url)) problems.push('缺官网链接');
  }
  /* 独立内容盘点：当前仅目录级字段，无 summary/bestFor/pros/limitations/editorialReviewedAt */
  const enriched = ['summary', 'bestFor', 'notFor', 'pros', 'limitations', 'editorialReviewedAt'].filter(k => t[k]);
  if (problems.length) bad++;
  rows.push({ t, url, indexable, enriched, problems });
}

mkdirSync(REPORTS, { recursive: true });
const md = `# 工具详情页索引审核报告

生成：2026-10-28，由 scripts/audit-tool-pages.mjs 对 dist/ 实际页面与 tools.json 逐条核验（可重复执行）。

## 审核规则

- 自研工具（own:true，5 个）：不生成独立详情页，其功能模块页（/cost/、/models/、/compare/、/quiz/、/prompts/）具备真实可用功能与方法说明，正常索引。
- 第三方工具详情页（12 个）：当前内容仅为 标语 + 分类 + 适用场景 + 收费模式 + 官网链接 + 核验日期，属目录级信息，无独立评测价值 → 逐项审核结论均为 \`indexable: false\`（已显式写入 tools.json），页面输出 \`noindex,follow\` 并从 sitemap 移除。
- 不删除 URL、不隐藏入口：页面仍可通过 /tools/ 工具库正常访问，canonical 保持自引用（不指向无关页面）。
- 恢复索引条件：为该工具补充真实、经核验的独立内容（如 summary / bestFor / notFor / pros / limitations / pricingUrl / editorialReviewedAt 等）后，将 tools.json 中该项 indexable 置为 true 并重跑 build + 全部检查。禁止凭空编造优缺点、实测结果或评价。

## 逐页审核结果

| # | 工具 | URL | 独立扩充内容 | robots | sitemap | 处置 |
|---|---|---|---|---|---|---|
${rows.map((r, i) => `| ${i + 1} | ${r.t.name} | ${r.url} | ${r.enriched.length ? r.enriched.join('、') : '无（仅目录级字段）'} | ${r.indexable ? 'index,follow' : 'noindex,follow'} | ${r.indexable ? '收录' : '排除'} | ${r.problems.length ? 'FAIL: ' + r.problems.join('；') : (r.indexable ? '保留索引（有独立内容）' : '不开放索引（薄页，保留用户访问）')} |`).join('\n')}

## 汇总

- 第三方详情页 ${rows.length} 个：noindex ${rows.filter(r => !r.indexable).length} / 可索引 ${rows.filter(r => r.indexable).length}。
- 自研工具 ${tools.length - rows.length} 个：无独立详情页，功能模块页正常索引。
- 审核异常 ${bad} 项。
`;
writeFileSync(join(REPORTS, 'tool-page-audit.md'), md, 'utf8');
R.check('工具详情页索引状态与 sitemap/robots/canonical 全部一致', bad === 0, `异常 ${bad} 项`);
R.pass('报告已写入', 'reports/tool-page-audit.md');
R.summary();
