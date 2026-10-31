/**
 * Markdown 指南文章数据访问层（唯一入口）。
 *
 * 事实源：src/content/guides/{zh-CN,en}/<slug>.md 的 frontmatter（不登记 pages.json）。
 * 排序：publishedAt 降序，同日按 entry id 升序（确定性，不依赖 Collection 默认顺序）。
 * 草稿：draft=true 只在开发服务器可见；生产构建不生成页面、不进 sitemap / content-manifest。
 * 冲突：slug 正则、保留字、与 pages.json 静态页路径冲突、同语言 translationKey 重复 → 构建期抛错。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { GUIDE_SLUG_RE, type GuideFrontmatter, type GuideCategory, type GuideSource, type GuideCover } from './schemas';

export type GuideLang = 'zh-CN' | 'en';

export interface ArticleSummary {
  lang: GuideLang;
  /** 文件名派生的路由 slug */
  slug: string;
  /** 站内路径（含尾斜杠） */
  path: string;
  title: string;
  description: string;
  category: GuideCategory;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  draft: boolean;
  indexable: boolean;
  author?: string;
  translationKey?: string | null;
  cover?: GuideCover;
  sources: GuideSource[];
  relatedSlugs: string[];
}

export type GuideEntry = CollectionEntry<'guidesZh'> | CollectionEntry<'guidesEn'>;

/**
 * 生产构建不输出草稿；开发服务器可预览草稿。
 * 用 MODE（dev=development / build=production）而不是 import.meta.env.DEV 判定：
 * 后者受外部 NODE_ENV 影响（本地若全局设了 NODE_ENV=production，DEV 会是 false，草稿在 dev 也看不到）。
 */
export const INCLUDE_DRAFTS = import.meta.env.MODE !== 'production';

const collectionOf = (lang: GuideLang): 'guidesZh' | 'guidesEn' => (lang === 'zh-CN' ? 'guidesZh' : 'guidesEn');

export const articlePath = (lang: GuideLang, slug: string): string =>
  lang === 'en' ? `/en/guides/${slug}/` : `/guides/${slug}/`;

function entrySlug(entry: GuideEntry): string {
  const slug = entry.id;
  if (!GUIDE_SLUG_RE.test(slug)) {
    throw new Error(
      `[guides] 文件名不符合 slug 规范：src/content/guides/**/${slug}.md —— 只允许小写英文/数字/连字符，且必须是单层文件`
    );
  }
  return slug;
}

function toSummary(lang: GuideLang, entry: GuideEntry): ArticleSummary {
  const data = entry.data as GuideFrontmatter;
  const slug = entrySlug(entry);
  return {
    lang,
    slug,
    path: articlePath(lang, slug),
    title: data.title,
    description: data.description,
    category: data.category,
    tags: data.tags,
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt,
    draft: data.draft,
    indexable: data.indexable,
    ...(data.author ? { author: data.author } : {}),
    ...(data.translationKey !== undefined ? { translationKey: data.translationKey } : {}),
    ...(data.cover ? { cover: data.cover } : {}),
    sources: data.sources || [],
    relatedSlugs: data.relatedArticles || []
  };
}

/** 确定性排序：publishedAt 降序 → slug 升序 */
export function sortArticles(list: ArticleSummary[]): ArticleSummary[] {
  return [...list].sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}

/** 某语言的全部文章（含草稿，仅供预览/校验用） */
export async function getAllArticles(lang: GuideLang): Promise<Array<{ summary: ArticleSummary; entry: GuideEntry }>> {
  const entries = (await getCollection(collectionOf(lang))) as GuideEntry[];
  return entries.map(entry => ({ summary: toSummary(lang, entry), entry }));
}

/** 站点可见文章：生产构建排除草稿 */
export async function getVisibleArticles(lang: GuideLang): Promise<Array<{ summary: ArticleSummary; entry: GuideEntry }>> {
  const all = await getAllArticles(lang);
  const list = INCLUDE_DRAFTS ? all : all.filter(a => !a.summary.draft);
  return list.sort((a, b) => {
    const s = sortArticles([a.summary, b.summary]);
    return s[0] === a.summary ? -1 : 1;
  });
}

/** 已发布文章摘要（draft=false；sitemap / content-manifest / 列表页使用） */
export async function getPublishedArticles(lang: GuideLang): Promise<ArticleSummary[]> {
  const all = await getAllArticles(lang);
  return sortArticles(all.filter(a => !a.summary.draft).map(a => a.summary));
}

/** 单篇文章（页面渲染用；不存在或生产环境为草稿时抛错） */
export async function getArticle(lang: GuideLang, slug: string): Promise<{ summary: ArticleSummary; entry: GuideEntry }> {
  const all = await getAllArticles(lang);
  const found = all.find(a => a.summary.slug === slug);
  if (!found) throw new Error(`[guides] 文章不存在：${lang}/${slug}.md`);
  if (found.summary.draft && !INCLUDE_DRAFTS) {
    throw new Error(`[guides] 草稿不得在生产构建中输出：${lang}/${slug}.md`);
  }
  return found;
}

/** 中英对应文章（仅当双方都已发布且 translationKey 相同；不存在返回 null，不伪造 URL） */
export async function getTranslation(lang: GuideLang, slug: string): Promise<ArticleSummary | null> {
  const current = (await getAllArticles(lang)).find(a => a.summary.slug === slug)?.summary;
  if (!current || !current.translationKey) return null;
  const other: GuideLang = lang === 'en' ? 'zh-CN' : 'en';
  const all = await getPublishedArticles(other);
  return all.find(a => a.translationKey === current.translationKey) || null;
}

/** 相关文章：只保留同语言内真实存在且已发布的条目 */
export async function getRelatedArticles(lang: GuideLang, slugs: string[]): Promise<ArticleSummary[]> {
  if (!slugs.length) return [];
  const published = await getPublishedArticles(lang);
  const bySlug = new Map(published.map(a => [a.slug, a]));
  return slugs.map(s => bySlug.get(s)).filter((a): a is ArticleSummary => Boolean(a));
}

export interface GuideConflictReport {
  errors: string[];
}

/**
 * 构建期冲突检测（保存到 pages.json 的静态页不冲突；只检测 Markdown 文章侧）。
 * @param staticPaths pages.json 登记的既有路径集合（用于检测 slug 与静态指南页冲突）
 */
export async function validateGuides(staticPaths: string[]): Promise<GuideConflictReport> {
  const errors: string[] = [];
  const reservedSlugs = new Set(['index']);
  for (const lang of ['zh-CN', 'en'] as GuideLang[]) {
    const all = await getAllArticles(lang);
    const seenKeys = new Map<string, string>();
    for (const { summary } of all) {
      if (reservedSlugs.has(summary.slug)) errors.push(`[guides] 保留 slug 不可用：${lang}/${summary.slug}.md`);
      if (staticPaths.includes(summary.path)) {
        errors.push(`[guides] 与已有静态页面路径冲突：${summary.path}（${lang}/${summary.slug}.md）`);
      }
      if (summary.translationKey) {
        const prev = seenKeys.get(summary.translationKey);
        if (prev) errors.push(`[guides] 同语言 translationKey 重复：${summary.translationKey}（${prev} 与 ${summary.slug}）`);
        else seenKeys.set(summary.translationKey, summary.slug);
      }
    }
  }
  return { errors };
}

/** content-manifest 产物条目（已发布文章；供 sitemap / 检查脚本复用） */
export interface ArticleManifestEntry {
  lang: GuideLang;
  slug: string;
  path: string;
  lastmod: string;
  indexable: boolean;
  category: string;
  translationKey: string | null;
}

export async function buildArticleManifest(): Promise<ArticleManifestEntry[]> {
  const out: ArticleManifestEntry[] = [];
  for (const lang of ['zh-CN', 'en'] as GuideLang[]) {
    for (const a of await getPublishedArticles(lang)) {
      out.push({
        lang,
        slug: a.slug,
        path: a.path,
        lastmod: a.updatedAt,
        indexable: a.indexable,
        category: a.category,
        translationKey: a.translationKey || null
      });
    }
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
