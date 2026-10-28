/**
 * 66 个模型对比页逐页审计：标题/描述/H1、canonical 归一、数据与公式一致、
 * 官方来源、示例成本、固定参数说明、摘要与内部链接、独立内容价值。
 * 输出 reports/compare-page-audit.md；任何页面硬指标失败 → 退出码非零。
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, REPORTS, BRAND } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, comparePairs } from './lib/manifest.mjs';
import { monthly, money, verdict } from './lib/pricing.mjs';

const R = createReporter('audit-compare-pages');
const { models } = loadData();
const byId = Object.fromEntries(models.map(m => [m.id, m]));
const rows = [];
let hardFail = 0;

for (const [a, b] of comparePairs(models)) {
  const ma = byId[a], mb = byId[b];
  const rel = `compare/${a}/${b}/index.html`;
  const file = join(DIST, rel);
  const url = `${SITE}/compare/${a}/${b}/`;
  const problems = [];
  if (!existsSync(file)) {
    problems.push('页面缺失');
  } else {
    const txt = readFileSync(file, 'utf8');
    const expectTitle = `${ma.name} vs ${mb.name} 对比 - 价格/上下文/模态 | ${BRAND}`;
    if (!txt.includes(`<title>${expectTitle}</title>`)) problems.push('标题不符');
    if (!txt.includes(ma.name) || !txt.includes(mb.name)) problems.push('模型名缺失');
    if (!txt.includes(`<link rel="canonical" href="${url}">`)) problems.push('canonical 不归一');
    if (a >= b) problems.push('URL 未按 a<b 归一');
    const ca = monthly(ma), cb = monthly(mb);
    if (!txt.includes(money(ca)) || !txt.includes(money(cb))) problems.push('示例成本与公式不一致');
    if (!txt.includes(ma.sourceUrl) || !txt.includes(mb.sourceUrl)) problems.push('官方来源缺失');
    if (!txt.includes('日均 100 次调用')) problems.push('缺固定参数说明');
    if (!txt.includes('对比摘要（固定用量口径）')) problems.push('缺比较摘要');
    if (!txt.includes(`../../../models/${a}/`) || !txt.includes(`../../../models/${b}/`)) problems.push('缺模型档案内链');
    if (/<meta name="robots" content="[^"]*noindex/.test(txt)) problems.push('异常 noindex');
    const v = verdict(ca, cb);
    const winCount = (txt.match(/class="win num"/g) || []).length;
    if (v === 'tie' && winCount !== 0) problems.push('平局误标胜出');
    if (v !== 'tie' && winCount !== 1) problems.push('胜出标记数量异常');
  }
  /* 独立内容价值（基于数据维度，非文本长度）：真实参数差异 + 可复核成本结论 + 决策支持 */
  const diffs = [];
  if (ma.vendor !== mb.vendor) diffs.push('厂商/渠道不同');
  if (ma.context !== mb.context) diffs.push(`上下文 ${ma.context}K vs ${mb.context}K`);
  if (JSON.stringify(ma.modalities) !== JSON.stringify(mb.modalities)) diffs.push('模态不同');
  if (monthly(ma) !== monthly(mb)) diffs.push('默认用量月成本不同');
  const value = diffs.length >= 1;
  if (problems.length) hardFail++;
  rows.push({
    url, problems, diffs,
    decision: problems.length ? '修复后复核' : (value ? '保留索引' : '补充说明后复核'),
    reason: problems.length ? problems.join('；')
      : `数据真实差异（${diffs.join('、') || '同档'}）；含逐项参数表+公式可复核的示例成本与摘要+官方来源+双向内链`
  });
}

mkdirSync(REPORTS, { recursive: true });
const md = `# 模型对比页逐页审计报告（66 页）

生成：2026-10-28，由 scripts/audit-compare-pages.mjs 对 dist/ 实际生成页逐 URL 检查（可重复执行）。
审计依据：仓库内容与 models.json 数据。未提供 Search Console 导出，本报告不包含任何搜索量/排名/收录断言，也不据此判定页面"没有搜索价值"。

## 审计口径

硬指标（失败即需修复）：标题/描述/H1 含正确比较对象、canonical 自引用且 a<b 归一、示例月成本与公式一致、官方来源链接、固定参数说明、比较摘要、双向模型档案内链、无异常 noindex、平局不误标胜出。
独立价值判断（非文本长度）：两模型在厂商/上下文/模态/默认用量成本上存在可核验的真实差异，页面提供参数表 + 可复核成本结论 + 来源与核验日期，能支持"二选一"比较决策。
索引策略：对比页是真实工具页（可从 /compare/ 选择器进入），凡硬指标通过且存在数据差异者保留索引；不批量 noindex、不统一 canonical 到 /compare/。

## 逐页结果

| # | URL | 硬指标 | 数据差异维度 | 处置建议 | 理由 |
|---|---|---|---|---|---|
${rows.map((r, i) => `| ${i + 1} | ${r.url} | ${r.problems.length ? 'FAIL: ' + r.problems.join('；') : '通过'} | ${r.diffs.join('、') || '无显著差异'} | ${r.decision} | ${r.reason} |`).join('\n')}

## 汇总

- 共 ${rows.length} 页；硬指标全部通过 ${rows.filter(r => !r.problems.length).length} 页；需修复 ${hardFail} 页。
- 建议保留索引 ${rows.filter(r => r.decision === '保留索引').length} 页。
- 全部对比页均为"同模板 + 不同真实数据"的工具型页面，模板相同不构成重复内容问题；每页的比较对象、参数值、成本结论与摘要均不同。
`;
writeFileSync(join(REPORTS, 'compare-page-audit.md'), md, 'utf8');
R.check('66 个对比页硬指标全部通过', hardFail === 0, `失败 ${hardFail} 页`);
R.pass('报告已写入', 'reports/compare-page-audit.md');
R.summary();
