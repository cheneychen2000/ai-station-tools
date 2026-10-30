/**
 * 语言路由映射：hreflang / canonical / sitemap / 语言切换器的唯一语言 URL 事实来源。
 *
 * 事实分层：
 *  - 手写页路由：assets/data/pages.json（id/type/path/en/日期）
 *  - 模型详情页路由：由 models.json 的 id 推导；英文详情白名单 = EN_MODELS（内容决策，未翻译不伪造 URL）
 *  本模块不提供任何页面文案与事实数据，只负责 URL ↔ 页面 ↔ 语言 的对应关系。
 */

export const LOCALES = ['zh-CN', 'en'];

export const LOCALE_HOME = { 'zh-CN': '/', 'en': '/en/' };
export const LOCALE_PREFIX = { 'zh-CN': '', 'en': '/en' };

/** 语言切换器上显示的是"目标语言"名称 */
export const SWITCH_LABEL = { 'zh-CN': '中文', 'en': 'English' };

/** 已有英文详情页的模型白名单（内容决策层）。全量扩展后 = 全部已发布模型 */
export const EN_MODELS = ['deepseek-v41-flash', 'deepseek-v4-pro', 'glm-53', 'glm-53-flash', 'kimi-k3', 'qwen35-plus', 'qwen37-plus', 'qwen38-flash', 'hunyuan-turbos-vision', 'minimax-m3', 'mimo-v25-pro', 'step-37-flash', 'gpt-6-luna', 'gpt-6-1-sol', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'gemini-3-1-flash-lite'];

/**
 * 构建全站路由映射（语言 URL 对应关系的唯一事实来源）。
 * @param pagesMeta pages.json 内容（手写页清单）
 * @param models    models.json（仅使用 id 推导路由）
 * @param compares  对比组合清单（[a,b] 数组，用于生成对比详情页路由）
 * @param tools     tools.json（仅使用 id/own/indexable 推导路由）
 * @returns Array<{ id, type, contentId|null, routes: { 'zh-CN': string, en?: string }, indexable: boolean }>
 */
export function buildRouteMap(pagesMeta, models, compares = [], tools = []) {
  const entries = (pagesMeta.pages || []).map(p => ({
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
  return entries;
}

/** 构建期硬校验：任何一项失败直接抛错终止构建（不允许带病出包） */
export function validateRouteMap(map) {
  const errors = [];
  const seen = new Map();
  for (const e of map) {
    if (!e.id) errors.push('存在缺 id 的页面记录');
    if (!e.routes['zh-CN']) errors.push(`${e.id} 缺中文路由`);
    for (const [lang, url] of Object.entries(e.routes)) {
      if (!LOCALES.includes(lang)) errors.push(`${e.id} 无效语言代码 ${lang}`);
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
export function pageByUrl(map, url) {
  return map.find(e => e.routes['zh-CN'] === url || e.routes.en === url) || null;
}

/** 由 URL 判定语言（站点约定：/en/ 前缀即英文） */
export function localeOf(url) {
  return (url === '/en/' || url.startsWith('/en/')) ? 'en' : 'zh-CN';
}

/** 页面可用的语言版本列表 */
export function availableLocales(page) {
  return LOCALES.filter(l => page.routes[l]);
}

/**
 * 语言切换目标（唯一回退算法）：
 *  1) 同一页面的目标语言版本存在 → 直达（保持业务上下文，如模型详情→同模型另一语言详情）；
 *  2) 否则沿当前 URL 逐级向上，取第一个在映射中真实存在的目标语言父级目录；
 *  3) 最终回退到目标语言首页。绝不构造映射中不存在的 URL。
 */
export function switchTarget(map, url, targetLocale) {
  const page = pageByUrl(map, url);
  if (page && page.routes[targetLocale]) return page.routes[targetLocale];
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
export function hreflangPairs(map, url) {
  const page = pageByUrl(map, url);
  if (!page || !page.routes.en) return [];
  return LOCALES.map(l => ({ lang: l, url: page.routes[l] }));
}
