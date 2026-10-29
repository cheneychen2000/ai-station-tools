/**
 * 站点页面清单与 sitemap lastmod 规则（build.mjs 与校验脚本的唯一来源）。
 *
 * lastmod 规则（禁止使用构建日期；核验时间 ≠ 内容更新时间）：
 *  - 模型详情页：该模型的 contentUpdatedAt（页面展示的 price/sourceUrl/spec 等实质字段最后变更日）
 *  - 对比页：参与对比两款模型 contentUpdatedAt 的较大者
 *  - 声明了 dependsOnModels / dependsOnTools 的手写页：手写内容 contentUpdatedAt 与所依赖数据 contentUpdatedAt 的较大者
 *  - 其余手写页：pages.json 中人工维护的 contentUpdatedAt
 *  - 仅核验（priceVerifiedAt/specVerifiedAt 更新）而展示内容未变时，不得更新 contentUpdatedAt / lastmod
 *  - 无法可靠确定更新时间的页面：lastmod = null（sitemap 中省略该字段）
 * 时间字段语义（models.json）：
 *  - verifiedAt：整条记录达到完整核验标准的日期（仅当价格与规格全部核验通过才更新）
 *  - priceVerifiedAt / specVerifiedAt：价格 / 规格字段各自的最后核验日期，可独立更新
 *  - contentUpdatedAt：页面可见内容（价格、来源链接、规格、文案）最后实质变更日期
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './paths.mjs';

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(DIST, rel), 'utf8'));
}

export function loadData() {
  return {
    models: loadJson('assets/data/models.json'),
    tools: loadJson('assets/data/tools.json'),
    pagesMeta: loadJson('assets/data/pages.json'),
    fx: loadJson('assets/data/fx.json'),
    compares: loadJson('assets/data/compares.json')
  };
}

/** ISO 日期（YYYY-MM-DD）字典序即时间序 */
export const maxDate = ds => ds.filter(Boolean).sort().pop() || null;

/**
 * 对比页规范 URL 对：全部模型两两全组合（2026-10-28 起按产品要求启用，17 款 → 136 组），
 * id 字典序 a<b 归一。compares.json extraPairs 保留兼容（已被全组合覆盖，去重后不额外生效）。
 */
export function comparePairs(models, extraPairs = []) {
  const ids = models.map(m => m.id).sort();
  const allIds = new Set(ids);
  const pairs = [];
  const seen = new Set();
  const push = (a, b) => {
    if (a === b || !allIds.has(a) || !allIds.has(b)) return;
    const k = [a, b].sort().join('/');
    if (!seen.has(k)) { seen.add(k); pairs.push([a, b].sort()); }
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) push(ids[i], ids[j]);
  }
  for (const [a, b] of extraPairs) push(a, b);
  return pairs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : 1));
}

/**
 * 工具详情页索引规则：
 *  - 自研工具（own:true）不生成独立详情页（其"详情页"就是功能模块本身），无索引问题
 *  - 第三方工具详情页默认不开放索引；只有逐项人工审核确认具备独立内容价值后，
 *    在 tools.json 中显式写 "indexable": true 才开放（严格布尔判定，缺失/字符串 "false" 一律视为不开放）
 */
export function isToolIndexable(t) {
  return !t.own && t.indexable === true;
}

/** 模型内容变更时间（缺失时保守回退 verifiedAt，再缺省略） */
export const modelContentDate = m => m.contentUpdatedAt || m.verifiedAt || null;

/** 生成 sitemap 条目清单 [{ path, lastmod }]；noindex 页面（第三方薄工具页）不进入清单 */
export function buildManifest({ models, tools, pagesMeta, compares = {} }) {
  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  const modelsContent = maxDate(models.map(modelContentDate));
  const extTools = tools.filter(t => !t.own);
  const toolsVerified = maxDate(extTools.map(t => t.verifiedAt));
  const entries = [];
  const push = (path, lastmod) => entries.push({ path, lastmod: lastmod || null });

  for (const p of pagesMeta.pages || []) {
    let d = p.contentUpdatedAt || null;
    if (p.dependsOnModels) d = maxDate([d, modelsContent]);
    if (p.dependsOnTools) d = maxDate([d, toolsVerified]);
    /* 英文模型页等单模型依赖页：lastmod 跟随该模型内容变更日（dependsOnModel 为模型 id） */
    if (p.dependsOnModel && byId[p.dependsOnModel]) d = maxDate([d, modelContentDate(byId[p.dependsOnModel])]);
    push(p.path, d);
    if (p.path === '/models/') {
      for (const m of models) push(`/models/${m.id}/`, modelContentDate(m));
    }
    if (p.path === '/compare/') {
      for (const [a, b] of comparePairs(models, compares.extraPairs || [])) push(`/compare/${a}/${b}/`, maxDate([modelContentDate(byId[a]), modelContentDate(byId[b])]));
    }
    if (p.path === '/tools/') {
      for (const t of extTools) {
        if (isToolIndexable(t)) push(`/tools/${t.id}/`, t.contentUpdatedAt || t.verifiedAt || null);
      }
    }
  }
  return entries;
}
