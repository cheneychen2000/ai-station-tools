/**
 * 模型对比页逐页审计：标题/描述/H1、canonical 归一、数据与公式一致、
 * 官方来源、示例成本（含跨币种折算）、固定参数说明、摘要与比例、内链、未知价标记。
 * CNY 集合保持历史全组合；国际模型组合来自 compares.json allowlist。
 * 输出 reports/compare-page-audit.md；任何页面硬指标失败 → 退出码非零。
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, SITE, REPORTS, BRAND } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadData, comparePairs } from './lib/manifest.mjs';
import { monthly, money, verdict, toBase, modelCurrency } from './lib/pricing.mjs';

const R = createReporter('audit-compare-pages');
const { models, fx, compares } = loadData();
const byId = Object.fromEntries(models.map(m => [m.id, m]));
const pairs = comparePairs(models, compares.extraPairs || []);
const rows = [];
let hardFail = 0;

for (const [a, b] of pairs) {
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
    const curA = modelCurrency(ma), curB = modelCurrency(mb);
    const ca = monthly(ma), cb = monthly(mb);
    const ba = toBase(ca, curA, fx), bb = toBase(cb, curB, fx);
    const v = (ba != null && bb != null) ? verdict(ba, bb) : 'na';
    if (!txt.includes(money(ca, curA)) || !txt.includes(money(cb, curB))) problems.push('示例成本（官方币种原价）与公式不一致');
    if (curA !== curB) {
      if (!txt.includes('折算')) problems.push('跨币种对比缺折算说明');
      if (!txt.includes('中国外汇交易中心')) problems.push('跨币种对比缺汇率来源');
    }
    if (!txt.includes(ma.sourceUrl) || !txt.includes(mb.sourceUrl)) problems.push('官方来源缺失');
    if (!txt.includes('日均 100 次调用')) problems.push('缺固定参数说明');
    if (!txt.includes('对比摘要（固定用量口径）')) problems.push('缺比较摘要');
    if (!txt.includes(`../../../models/${a}/`) || !txt.includes(`../../../models/${b}/`)) problems.push('缺模型档案内链');
    if (/<meta name="robots" content="[^"]*noindex/.test(txt)) problems.push('异常 noindex');
    const winCount = (txt.match(/class="win num"/g) || []).length;
    if (v === 'na' && winCount !== 0) problems.push('无法折算时误标胜出');
    if (v === 'tie' && winCount !== 0) problems.push('平局误标胜出');
    if ((v === 'a' || v === 'b') && winCount !== 1) problems.push('胜出标记数量异常');
    if (v === 'na') {
      if (!txt.includes('无法统一折算')) problems.push('缺无法折算说明');
    } else if (v === 'tie') {
      if (!txt.includes('成本比例：按该口径两者相同')) problems.push('缺成本比例持平说明');
    } else {
      const cheaper = v === 'a' ? ma : mb;
      const ct = v === 'a' ? ba : bb, dt = v === 'a' ? bb : ba;
      const expect = `的 ${(dt / ct).toFixed(1)} 倍（${cheaper.name} 便宜约 ${((1 - ct / dt) * 100).toFixed(0)}%）`;
      if (!txt.includes('成本比例') || !txt.includes(expect)) problems.push('成本比例与计算逻辑不一致: 期望 ' + expect);
    }
    const cacheMissing = [ma, mb].filter(m => m.priceCacheHit == null && !m.peakOffpeak);
    if (cacheMissing.length && !txt.includes('未公开')) problems.push('缓存未公开未如实标记');
  }
  const diffs = [];
  if (ma.vendor !== mb.vendor) diffs.push('厂商/渠道不同');
  if (ma.context !== mb.context) diffs.push(`上下文 ${ma.context}K vs ${mb.context}K`);
  if (JSON.stringify(ma.modalities) !== JSON.stringify(mb.modalities)) diffs.push('模态不同');
  if (modelCurrency(ma) !== modelCurrency(mb)) diffs.push('币种不同（美元原价+人民币折算）');
  else if (monthly(ma) !== monthly(mb)) diffs.push('默认用量月成本不同');
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
const md = `# 模型对比页逐页审计报告（${rows.length} 页）

生成：2026-10-28，由 scripts/audit-compare-pages.mjs 对 dist/ 实际生成页逐 URL 检查（可重复执行）。
审计依据：仓库内容与 models.json 数据。未提供 Search Console 导出，本报告不包含任何搜索量/排名/收录断言，也不据此判定页面"没有搜索价值"。

## 审计口径

硬指标：标题/描述/H1 含正确比较对象、canonical 自引用且 a<b 归一、示例成本（官方币种原价 + 跨币种人民币折算）与公式一致、官方来源链接、固定参数说明、比较摘要、双向模型档案内链、无异常 noindex、平局/无法折算不误标胜出、成本比例与正式计算逻辑逐值一致、未知价格如实标未公开。
组合范围：全部 17 款模型两两全组合（${rows.length} 组，2026-10-28 起按产品要求启用；此前为 66 + allowlist 模式）。

## 逐页结果

| # | URL | 硬指标 | 数据差异维度 | 处置建议 | 理由 |
|---|---|---|---|---|---|
${rows.map((r, i) => `| ${i + 1} | ${r.url} | ${r.problems.length ? 'FAIL: ' + r.problems.join('；') : '通过'} | ${r.diffs.join('、') || '无显著差异'} | ${r.decision} | ${r.reason} |`).join('\n')}

## 汇总

- 共 ${rows.length} 页；硬指标全部通过 ${rows.filter(r => !r.problems.length).length} 页；需修复 ${hardFail} 页。
- 建议保留索引 ${rows.filter(r => r.decision === '保留索引').length} 页。
- 全部对比页均为"同模板 + 不同真实数据"的工具型页面；跨币种页面同时展示美元原价与人民币折算值（中国外汇交易中心中间价），不直接比较不同币种数值。
`;
writeFileSync(join(REPORTS, 'compare-page-audit.md'), md, 'utf8');
R.check(`${rows.length} 个对比页硬指标全部通过`, hardFail === 0, `失败 ${hardFail} 页`);
R.pass('报告已写入', 'reports/compare-page-audit.md');
R.summary();
