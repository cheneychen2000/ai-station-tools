/**
 * 站点页面清单与 sitemap lastmod 规则（页面、端点与校验脚本的唯一规则来源）。
 *
 * lastmod 规则（禁止使用构建日期；核验时间 ≠ 内容更新时间）：
 *  - 模型详情页：该模型的 contentUpdatedAt（页面展示的 price/sourceUrl/spec 等实质字段最后变更日）
 *  - 对比页：参与对比两款模型 contentUpdatedAt 的较大者
 *  - 声明了 dependsOnModels / dependsOnTools 的手写页：手写内容 contentUpdatedAt 与所依赖数据 contentUpdatedAt 的较大者
 *  - 其余手写页：pages.json 中人工维护的 contentUpdatedAt
 *  - 仅核验（priceVerifiedAt/specVerifiedAt 更新）而展示内容未变时，不得更新 contentUpdatedAt / lastmod
 *  - 无法可靠确定更新时间的页面：lastmod = null（sitemap 中省略该字段）
 * 算法与迁移前 src/lib/manifest.mjs 逐行等价（仅增加类型约束）。
 */
import type { Model, Tool, PagesFile, ComparesFile } from '../data/schemas';
/* .ts 扩展名 + 仅可擦除语法：本模块可被检查脚本经 Node 原生类型剥离直接加载（scripts/lib 收敛层） */
import { EN_MODELS } from '../i18n/locales.ts';

/** ISO 日期（YYYY-MM-DD）字典序即时间序 */
export const maxDate = (ds: Array<string | null | undefined>): string | null => ds.filter(Boolean).sort().pop() || null;

export type ComparePair = [string, string];

/**
 * 对比页规范 URL 对：全部模型两两全组合，id 字典序 a<b 归一。
 * compares.json extraPairs 保留兼容（已被全组合覆盖，去重后不额外生效）。
 */
export function comparePairs(models: Model[], extraPairs: ComparePair[] = []): ComparePair[] {
  const ids = models.map(m => m.id).sort();
  const allIds = new Set(ids);
  const pairs: ComparePair[] = [];
  const seen = new Set<string>();
  const push = (a: string, b: string) => {
    if (a === b || !allIds.has(a) || !allIds.has(b)) return;
    const k = [a, b].sort().join('/');
    if (!seen.has(k)) { seen.add(k); pairs.push([a, b].sort() as ComparePair); }
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
export function isToolIndexable(t: Tool): boolean {
  return !t.own && t.indexable === true;
}

/** 模型内容变更时间（缺失时保守回退 verifiedAt，再缺省略） */
export const modelContentDate = (m: Model): string | null => m.contentUpdatedAt || m.verifiedAt || null;

export interface ManifestEntry { path: string; lastmod: string | null }

/** Markdown 文章条目（只含已发布且 indexable 的文章；lastmod = 文章 updatedAt，禁止构建日期） */
export interface ManifestArticle { path: string; lastmod: string | null }

/** 生成 sitemap 条目清单 [{ path, lastmod }]；noindex 页面（第三方薄工具页 / noindex 文章）不进入清单 */
export function buildManifest({ models, tools, pagesMeta, compares, articles = [] }: {
  models: Model[];
  tools: Tool[];
  pagesMeta: PagesFile;
  compares?: ComparesFile;
  articles?: ManifestArticle[];
}): ManifestEntry[] {
  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  const modelsContent = maxDate(models.map(modelContentDate));
  const extTools = tools.filter(t => !t.own);
  const toolsVerified = maxDate(extTools.map(t => t.verifiedAt));
  const entries: ManifestEntry[] = [];
  const push = (path: string, lastmod: string | null) => entries.push({ path, lastmod: lastmod || null });

  for (const p of pagesMeta.pages || []) {
    let d = p.contentUpdatedAt || null;
    if (p.dependsOnModels) d = maxDate([d, modelsContent]);
    if (p.dependsOnTools) d = maxDate([d, toolsVerified]);
    /* 英文模型页等单模型依赖页：lastmod 跟随该模型内容变更日（dependsOnModel 为模型 id） */
    if (p.dependsOnModel && byId[p.dependsOnModel]) d = maxDate([d, modelContentDate(byId[p.dependsOnModel])]);
    push(p.path, d);
    /* 英文版本：与中文同规则取 lastmod（仅当 pages.json 登记了真实存在的 en 路由） */
    if (p.en) {
      let de = p.enContentUpdatedAt || null;
      if (p.dependsOnModels) de = maxDate([de, modelsContent]);
      if (p.dependsOnTools) de = maxDate([de, toolsVerified]);
      push(p.en, de);
    }
    if (p.path === '/models/') {
      for (const m of models) push(`/models/${m.id}/`, modelContentDate(m));
      if (p.en) for (const id of EN_MODELS) push(`/en/models/${id}/`, modelContentDate(byId[id]));
    }
    if (p.path === '/compare/') {
      for (const [a, b] of comparePairs(models, compares?.extraPairs || [])) {
        const d = maxDate([modelContentDate(byId[a]), modelContentDate(byId[b])]);
        push(`/compare/${a}/${b}/`, d);
        if (p.en) push(`/en/compare/${a}/${b}/`, d);
      }
    }
    if (p.path === '/tools/') {
      for (const t of extTools) {
        if (isToolIndexable(t)) {
          push(`/tools/${t.id}/`, t.contentUpdatedAt || t.verifiedAt || null);
          if (p.en) push(`/en/tools/${t.id}/`, t.contentUpdatedAt || t.verifiedAt || null);
        }
      }
    }
  }
  /* Markdown 文章：元数据只在 frontmatter 维护，此处按已发布清单追加（确定性顺序 = 传入顺序） */
  for (const a of articles) push(a.path, a.lastmod);
  return entries;
}
