/**
 * 统一数据访问层：页面/组件/端点只从这里取数据。
 *  - models / tools / prompts：Content Collections（file loader + Zod Schema）；
 *  - pages / fx / compares / partners / ads / quiz：独立 Zod Schema 校验的直接 JSON 读取
 *    （非页面内容集合，无需占用 Content Collections）。
 * 所有读取结果均为 models.json 等唯一事实源的原样数据，不做任何业务改写。
 */
import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  pagesFileSchema, comparesFileSchema, fxFileSchema,
  partnersFileSchema, adsFileSchema, quizItemSchema,
  type Model, type Tool, type Prompt, type QuizItem,
  type PagesFile, type ComparesFile, type FxFile, type Partner, type AdsConfig
} from './schemas';
import { comparePairs, type ComparePair } from '../domain/manifest';
import { buildRouteMap, validateRouteMap, type RouteEntry, type ArticleRouteInput } from '../i18n/locales';
import { getVisibleArticles, validateGuides, type ArticleSummary } from './guides';

const DATA_DIR = join(process.cwd(), 'public', 'assets', 'data');

function readJson<T>(file: string, schema: { parse: (input: unknown) => T }): T {
  return schema.parse(JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')));
}

/* Content Collections 的 file loader 会按 id 排序条目，而站点既有排序逻辑（模型库卡片、sitemap 条目）
   以 JSON 文件数组顺序为准——这里按源文件顺序还原，保证"模型排序逻辑"与迁移前完全一致。 */
function fileOrder(file: string): string[] {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')).map((x: { id: string }) => x.id);
}

function byFileOrder<T extends { id: string }>(list: T[], order: string[]): T[] {
  const idx = new Map(order.map((id, i) => [id, i]));
  return list.sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));
}

export async function getModels(): Promise<Model[]> {
  const models = (await getCollection('models')).map(e => e.data as Model);
  return byFileOrder(models, fileOrder('models.json'));
}

export async function getModelById(id: string): Promise<Model | null> {
  return (await getModels()).find(m => m.id === id) || null;
}

export async function getTools(): Promise<Tool[]> {
  const tools = (await getCollection('tools')).map(e => e.data as Tool);
  return byFileOrder(tools, fileOrder('tools.json'));
}

export async function getToolById(id: string): Promise<Tool | null> {
  return (await getTools()).find(t => t.id === id) || null;
}

export async function getPrompts(): Promise<Prompt[]> {
  const prompts = (await getCollection('prompts')).map(e => e.data as Prompt);
  return byFileOrder(prompts, fileOrder('prompts.json'));
}

export const getPagesMeta = (): PagesFile => readJson('pages.json', pagesFileSchema);
export const getCompares = (): ComparesFile => readJson('compares.json', comparesFileSchema);
export const getFx = (): FxFile => readJson('fx.json', fxFileSchema);
export const getPartners = (): Partner[] => readJson('partners.json', partnersFileSchema).partners || [];
export const getAdsConfig = (): AdsConfig => readJson('ads.json', adsFileSchema);
export const getQuizBank = (): QuizItem[] => readJson('quiz.json', quizItemSchema.array());

export interface SiteData {
  models: Model[];
  tools: Tool[];
  pagesMeta: PagesFile;
  fx: FxFile;
  compares: ComparesFile;
  /** 全部对比组合（a<b 归一；17 款模型两两全组合 = 136 组） */
  pairs: ComparePair[];
  /** Markdown 指南文章（生产构建不含草稿；开发服务器含草稿） */
  articles: ArticleSummary[];
  /** 全站语言 URL 唯一事实来源；任一校验失败直接中断构建 */
  routeMap: RouteEntry[];
}

let siteDataPromise: Promise<SiteData> | null = null;

/** 站点级共享状态：一次加载数据、一次构建路由映射，供全部页面与组件复用（构建进程内缓存）。 */
export function getSiteData(): Promise<SiteData> {
  if (!siteDataPromise) {
    siteDataPromise = (async () => {
      const [models, tools, zh, en] = await Promise.all([getModels(), getTools(), getVisibleArticles('zh-CN'), getVisibleArticles('en')]);
      const pagesMeta = getPagesMeta();
      const compares = getCompares();
      const fx = getFx();
      const pairs = comparePairs(models, compares.extraPairs || []);
      const articles = [...zh.map(a => a.summary), ...en.map(a => a.summary)];

      /* Markdown 文章冲突检测：slug 规范/保留字、与 pages.json 静态页路径冲突、同语言 translationKey 重复 */
      const conflicts = await validateGuides((pagesMeta.pages || []).map(p => p.path).concat((pagesMeta.pages || []).flatMap(p => (p.en ? [p.en] : []))));
      if (conflicts.errors.length) {
        throw new Error('Markdown 指南冲突校验失败：\n  - ' + conflicts.errors.join('\n  - '));
      }

      const articleRoutes: ArticleRouteInput[] = articles.map(a => ({
        lang: a.lang,
        slug: a.slug,
        path: a.path,
        indexable: a.indexable,
        translationKey: a.translationKey || null
      }));
      const routeMap = validateRouteMap(buildRouteMap(pagesMeta, models, pairs, tools, articleRoutes));
      return { models, tools, pagesMeta, fx, compares, pairs, articles, routeMap };
    })();
  }
  return siteDataPromise;
}
