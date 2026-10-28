/**
 * 站点页面清单与 sitemap lastmod 规则（build.mjs 与校验脚本的唯一来源）。
 *
 * lastmod 规则（禁止使用构建日期）：
 *  - 模型详情页：该模型的 verifiedAt（页面内容完全由该模型数据推导，数据核验即内容更新）
 *  - 对比页：参与对比两款模型 verifiedAt 的较大者
 *  - 声明了 dependsOnModels / dependsOnTools 的手写页：手写内容 contentUpdatedAt 与所依赖数据 verifiedAt 的较大者
 *  - 其余手写页：pages.json 中人工维护的 contentUpdatedAt
 *  - 无法可靠确定更新时间的页面：lastmod = null（sitemap 中省略该字段）
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
    pagesMeta: loadJson('assets/data/pages.json')
  };
}

/** ISO 日期（YYYY-MM-DD）字典序即时间序 */
export const maxDate = ds => ds.filter(Boolean).sort().pop() || null;

/** 对比页规范 URL 对：id 字典序 a<b 归一 */
export function comparePairs(models) {
  const sorted = models.map(m => m.id).sort();
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) pairs.push([sorted[i], sorted[j]]);
  }
  return pairs;
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

/** 生成 sitemap 条目清单 [{ path, lastmod }]；noindex 页面（第三方薄工具页）不进入清单 */
export function buildManifest({ models, tools, pagesMeta }) {
  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  const modelsVerified = maxDate(models.map(m => m.verifiedAt));
  const extTools = tools.filter(t => !t.own);
  const toolsVerified = maxDate(extTools.map(t => t.verifiedAt));
  const entries = [];
  const push = (path, lastmod) => entries.push({ path, lastmod: lastmod || null });

  for (const p of pagesMeta.pages || []) {
    let d = p.contentUpdatedAt || null;
    if (p.dependsOnModels) d = maxDate([d, modelsVerified]);
    if (p.dependsOnTools) d = maxDate([d, toolsVerified]);
    push(p.path, d);
    if (p.path === '/models/') {
      for (const m of models) push(`/models/${m.id}/`, m.verifiedAt || null);
    }
    if (p.path === '/compare/') {
      for (const [a, b] of comparePairs(models)) push(`/compare/${a}/${b}/`, maxDate([byId[a].verifiedAt, byId[b].verifiedAt]));
    }
    if (p.path === '/tools/') {
      for (const t of extTools) {
        if (isToolIndexable(t)) push(`/tools/${t.id}/`, t.contentUpdatedAt || t.verifiedAt || null);
      }
    }
  }
  return entries;
}
