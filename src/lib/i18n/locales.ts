/**
 * 语言路由映射：hreflang / canonical / sitemap / 语言切换器的唯一语言 URL 事实来源。
 *
 * 事实分层：
 *  - 手写页路由：assets/data/pages.json（id/type/path/en/日期）
 *  - 模型详情页路由：由 models.json 的 id 推导；英文详情白名单 = EN_MODELS（内容决策，未翻译不伪造 URL）
 *  本模块不提供任何页面文案与事实数据，只负责 URL ↔ 页面 ↔ 语言 的对应关系。
 * 与迁移前 src/lib/locales.mjs 逐行等价（仅增加类型约束）。
 */
import type { Model, Tool, PagesFile } from '../data/schemas';
import type { ComparePair } from '../domain/manifest';

export const LOCALES = ['zh-CN', 'en'] as const;
export type Locale = typeof LOCALES[number];

export const LOCALE_HOME: Record<Locale, string> = { 'zh-CN': '/', 'en': '/en/' };
export const LOCALE_PREFIX: Record<Locale, string> = { 'zh-CN': '', 'en': '/en' };

/** 语言切换器上显示的是"目标语言"名称 */
export const SWITCH_LABEL: Record<Locale, string> = { 'zh-CN': '中文', 'en': 'English' };

/** 已有英文详情页的模型白名单（内容决策层）。全量扩展后 = 全部已发布模型 */
export const EN_MODELS = ['deepseek-v41-flash', 'deepseek-v4-pro', 'glm-53', 'glm-53-flash', 'kimi-k3', 'qwen35-plus', 'qwen37-plus', 'qwen38-flash', 'hunyuan-turbos-vision', 'minimax-m3', 'mimo-v25-pro', 'step-37-flash', 'gpt-6-luna', 'gpt-6-1-sol', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'gemini-3-1-flash-lite'];

export interface RouteEntry {
  id: string;
  type: string;
  contentId: string | null;
  /** 至少存在一种语言；英文单语文章不会伪造中文 URL（反之亦然） */
  routes: { 'zh-CN'?: string; en?: string };
  indexable: boolean;
}

/** Markdown 文章的路由输入（按 translationKey 合并中英；无 key 时各自独立成条） */
export interface ArticleRouteInput {
  lang: Locale;
  slug: string;
  path: string;
  indexable: boolean;
  translationKey?: string | null;
}

/** 构建全站路由映射（语言 URL 对应关系的唯一事实来源） */
export function buildRouteMap(
  pagesMeta: PagesFile,
  models: Model[],
  compares: ComparePair[] = [],
  tools: Tool[] = [],
  articles: ArticleRouteInput[] = []
): RouteEntry[] {
  const entries: RouteEntry[] = (pagesMeta.pages || []).map(p => ({
    id: p.id,
    type: p.type,
    contentId: p.contentId || null,
    routes: { 'zh-CN': p.path, ...(p.en ? { en: p.en } : {}) },
    indexable: p.indexable !== false
  }));
  for (const m of models) {
    entries.push({
      id: `model-${m.id}`,
      type: 'model-detail',
      contentId: m.id,
      routes: { 'zh-CN': `/models/${m.id}/`, ...(EN_MODELS.includes(m.id) ? { en: `/en/models/${m.id}/` } : {}) },
      indexable: true
    });
  }
  for (const [a, b] of compares) {
    entries.push({
      id: `compare-${a}-${b}`,
      type: 'compare-detail',
      contentId: `${a}/${b}`,
      routes: { 'zh-CN': `/compare/${a}/${b}/`, en: `/en/compare/${a}/${b}/` },
      indexable: true
    });
  }
  for (const t of tools) {
    if (t.own) continue; /* 自研工具无独立详情页 */
    entries.push({
      id: `tool-${t.id}`,
      type: 'tool-detail',
      contentId: t.id,
      routes: { 'zh-CN': `/tools/${t.id}/`, en: `/en/tools/${t.id}/` },
      indexable: t.indexable === true /* 严格继承中文页索引审核结论，英文页不放宽 */
    });
  }
  /* Markdown 文章：同 translationKey 的中英两篇合并为一条路由记录（hreflang / 语言切换的唯一依据） */
  const byKey = new Map<string, RouteEntry>();
  for (const a of articles) {
    const key = a.translationKey ? `tk:${a.translationKey}` : `solo:${a.lang}:${a.slug}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { id: `article-${key}`, type: 'article', contentId: a.slug, routes: {}, indexable: a.indexable };
      byKey.set(key, entry);
      entries.push(entry);
    }
    entry.routes[a.lang] = a.path;
    if (a.lang === 'zh-CN') entry.contentId = a.slug;
  }
  return entries;
}

/** 构建期硬校验：任何一项失败直接抛错终止构建（不允许带病出包） */
export function validateRouteMap(map: RouteEntry[]): RouteEntry[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const e of map) {
    if (!e.id) errors.push('存在缺 id 的页面记录');
    /* 文章允许单语（只存在 en 的中文站文章不存在），但至少要有一条真实路由 */
    if (!e.routes['zh-CN'] && !e.routes.en) errors.push(`${e.id} 缺全部语言路由`);
    for (const [lang, url] of Object.entries(e.routes)) {
      if (!LOCALES.includes(lang as Locale)) errors.push(`${e.id} 无效语言代码 ${lang}`);
      if (typeof url !== 'string' || !url.startsWith('/') || !url.endsWith('/')) errors.push(`${e.id} ${lang} URL 非法：${url}`);
      if (lang === 'en' && url !== '/en/' && !url.startsWith('/en/')) errors.push(`${e.id} 英文 URL 不在 /en/ 下：${url}`);
      if (lang === 'zh-CN' && url.startsWith('/en/')) errors.push(`${e.id} 中文 URL 误入 /en/：${url}`);
      const prev = seen.get(url);
      if (prev) errors.push(`URL 重复：${url} 同时映射 ${prev} 与 ${e.id}（${lang}）`);
      else seen.set(url, `${e.id}`);
    }
  }
  if (!map.some(e => e.type === 'home')) errors.push('缺 home 页面记录');
  if (errors.length) throw new Error('路由映射校验失败：\n  - ' + errors.join('\n  - '));
  return map;
}

/** 按 URL 查页面记录（中/英任一语言 URL 均可命中同一记录） */
export function pageByUrl(map: RouteEntry[], url: string): RouteEntry | null {
  return map.find(e => e.routes['zh-CN'] === url || e.routes.en === url) || null;
}

/** 由 URL 判定语言（站点约定：/en/ 前缀即英文） */
export function localeOf(url: string): Locale {
  return (url === '/en/' || url.startsWith('/en/')) ? 'en' : 'zh-CN';
}

/** 页面可用的语言版本列表 */
export function availableLocales(page: RouteEntry): Locale[] {
  return LOCALES.filter(l => page.routes[l]);
}

/**
 * 语言切换目标（唯一回退算法）：
 *  1) 同一页面的目标语言版本存在 → 直达（保持业务上下文，如模型详情→同模型另一语言详情）；
 *  2) 否则沿当前 URL 逐级向上，取第一个在映射中真实存在的目标语言父级目录；
 *  3) 最终回退到目标语言首页。绝不构造映射中不存在的 URL。
 */
export function switchTarget(map: RouteEntry[], url: string, targetLocale: Locale): string {
  const page = pageByUrl(map, url);
  if (page && page.routes[targetLocale]) return page.routes[targetLocale]!;
  const urls = new Set(map.flatMap(e => Object.values(e.routes)));
  let p = url.replace(/index\.html$/, '');
  /* 先剥掉源语言前缀，再走祖先链，避免 en→zh 时把 /en/ 前缀带进中文候选 */
  const srcPrefix = LOCALE_PREFIX[localeOf(url)];
  if (srcPrefix && (p === srcPrefix || p.startsWith(srcPrefix + '/'))) p = p.slice(srcPrefix.length) || '/';
  if (p.endsWith('/')) p = p.slice(0, -1);
  while (p.includes('/')) {
    p = p.slice(0, p.lastIndexOf('/'));
    const cand = LOCALE_PREFIX[targetLocale] + p + '/';
    if (urls.has(cand)) return cand;
  }
  return LOCALE_HOME[targetLocale];
}

/**
 * 页面应输出的 hreflang 对（仅当两种语言版本都真实存在）。
 * 返回 [{lang, url}] 或 []（单语页面不输出 hreflang）。
 */
export function hreflangPairs(map: RouteEntry[], url: string): Array<{ lang: Locale; url: string }> {
  const page = pageByUrl(map, url);
  if (!page || !page.routes.en) return [];
  return LOCALES.map(l => ({ lang: l, url: page.routes[l]! }));
}
