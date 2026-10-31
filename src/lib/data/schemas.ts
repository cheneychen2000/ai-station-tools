/**
 * 数据 Schema（Zod）：Content Collections 与非集合 JSON 共用的结构契约。
 * 字段可空性严格对齐 public/assets/data/*.json 的真实形态；
 * catchall(z.unknown()) 保留暂未建模的扩展字段，保证"数据原样进出、不丢字段"。
 */
import { z } from 'astro/zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const priceTierSchema = z.object({
  desc: z.string(),
  /** 升序档位上界；null 表示最高档 */
  upToInputTokens: z.number().nullable(),
  priceIn: z.number().optional(),
  priceOut: z.number().optional(),
  priceCacheHit: z.number().nullable().optional(),
  priceCacheWrite: z.number().nullable().optional(),
  /** 该档费率未公开：不得按 0 或低档价估算 */
  unverified: z.boolean().optional()
}).catchall(z.unknown());

export const peakOffpeakSchema = z.object({
  peakIn: z.number(),
  offIn: z.number(),
  peakOut: z.number(),
  offOut: z.number(),
  peakCache: z.number().nullable(),
  offCache: z.number().nullable(),
  peakWindow: z.string()
}).catchall(z.unknown());

export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor: z.string(),
  /** 上下文窗口（K tokens） */
  context: z.number(),
  currency: z.enum(['CNY', 'USD']).optional(),
  priceIn: z.number(),
  priceOut: z.number(),
  priceCacheHit: z.number().nullable(),
  priceCacheWrite: z.number().nullable().optional(),
  peakOffpeak: peakOffpeakSchema.nullable(),
  priceTiers: z.array(priceTierSchema).optional(),
  modalities: z.array(z.string()),
  features: z.array(z.string()),
  sourceName: z.string(),
  sourceUrl: z.string(),
  verifiedAt: isoDate,
  priceVerifiedAt: isoDate,
  specVerifiedAt: isoDate,
  contentUpdatedAt: isoDate,
  priceNote: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional()
}).catchall(z.unknown());

export const toolDetailSchema = z.object({
  sections: z.array(z.object({ h: z.string(), body: z.string() })).optional(),
  sources: z.array(z.object({ label: z.string(), url: z.string(), verifiedAt: isoDate })).optional()
}).catchall(z.unknown());

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  category: z.string(),
  free: z.string(),
  url: z.string(),
  scene: z.string(),
  verifiedAt: isoDate,
  contentUpdatedAt: isoDate.optional(),
  own: z.boolean().optional(),
  indexable: z.boolean().optional(),
  detail: toolDetailSchema.optional()
}).catchall(z.unknown());

export const promptSchema = z.object({
  id: z.string(),
  title: z.string(),
  scene: z.string(),
  prompt: z.object({ zh: z.string(), en: z.string() }),
  tags: z.array(z.string())
}).catchall(z.unknown());

export const quizItemSchema = z.object({
  dim: z.string(),
  hard: z.boolean(),
  q: z.string(),
  options: z.array(z.string()),
  answer: z.number(),
  explain: z.string()
}).catchall(z.unknown());

export const pageMetaSchema = z.object({
  id: z.string(),
  type: z.string(),
  path: z.string(),
  en: z.string().optional(),
  contentId: z.string().optional(),
  contentUpdatedAt: isoDate.optional(),
  enContentUpdatedAt: isoDate.optional(),
  dependsOnModels: z.boolean().optional(),
  dependsOnTools: z.boolean().optional(),
  dependsOnModel: z.string().optional(),
  indexable: z.boolean().optional()
}).catchall(z.unknown());

export const pagesFileSchema = z.object({
  description: z.string().optional(),
  pages: z.array(pageMetaSchema)
}).catchall(z.unknown());

export const comparesFileSchema = z.object({
  description: z.string().optional(),
  extraPairs: z.array(z.tuple([z.string(), z.string()])).default([])
}).catchall(z.unknown());

export const fxFileSchema = z.object({
  description: z.string().optional(),
  rates: z.record(z.string(), z.object({
    rate: z.number().optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    rateDate: isoDate.optional(),
    verifiedAt: isoDate.optional()
  }).catchall(z.unknown())).optional()
}).catchall(z.unknown());

export const partnerSchema = z.object({
  partnerId: z.string(),
  name: z.string(),
  category: z.string().optional(),
  officialUrl: z.string().optional(),
  officialTermsUrl: z.string().optional(),
  referralUrl: z.string().nullable().optional(),
  status: z.enum(['candidate', 'applied', 'approved', 'active', 'paused']),
  commissionTerms: z.string().nullable().optional(),
  lastVerifiedAt: isoDate.optional(),
  verifiedBy: z.string().optional(),
  placements: z.array(z.unknown()).optional(),
  disclosureText: z.string().optional()
}).catchall(z.unknown());

export const partnersFileSchema = z.object({
  description: z.string().optional(),
  partners: z.array(partnerSchema).default([])
}).catchall(z.unknown());

export const adsFileSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  publisherId: z.string().nullable().optional(),
  network: z.string().optional(),
  cmp: z.object({ status: z.string().optional(), note: z.string().optional() }).catchall(z.unknown()).optional(),
  slots: z.record(z.string(), z.object({ format: z.string().optional(), placement: z.string().optional() }).catchall(z.unknown())).optional()
}).catchall(z.unknown());

/* ============================ Markdown 指南文章 ============================ */

/** 稳定分类 ID（中英显示名见 src/lib/i18n/categories.ts） */
export const GUIDE_CATEGORIES = ['guide', 'tutorial', 'case-study', 'analysis', 'cost-optimization', 'model-selection'] as const;
export type GuideCategory = typeof GUIDE_CATEGORIES[number];

/** 文件名即路由 slug：小写英文/数字/连字符，不允许空格与路径穿越字符 */
export const GUIDE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const httpUrl = z.string().refine(v => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}, { message: '必须是合法的 http/https URL' });

export const guideSourceSchema = z.object({
  title: z.string().min(1, '参考资料标题不能为空'),
  url: httpUrl,
  accessedAt: isoDate.optional()
});

export const guideCoverSchema = z.object({
  /** 必须是站内本地资源路径（/assets/ 或 /images/ 下的图片） */
  src: z.string().regex(/^\/(assets|images)\/[A-Za-z0-9._\-/]+\.(png|jpe?g|webp|avif)$/, '封面必须是 /assets/ 或 /images/ 下的本地图片路径'),
  alt: z.string().min(1, '封面 alt 不能为空')
});

/**
 * 指南文章 Frontmatter（中英共用同一结构；文件名派生 slug，不设 slug 字段）。
 * 文章元数据唯一来源就是本 frontmatter——不再登记到 pages.json。
 */
export const guideSchema = z.object({
  title: z.string().trim().min(1, 'title 不能为空'),
  description: z.string().trim().min(1, 'description 不能为空'),
  publishedAt: isoDate,
  updatedAt: isoDate,
  category: z.enum(GUIDE_CATEGORIES),
  tags: z.array(z.string().min(1)),
  draft: z.boolean(),
  indexable: z.boolean(),
  author: z.string().trim().min(1).optional(),
  /** 中英文对应标识：同 key 的 zh/en 两篇视为同一篇文章的两个语言版本 */
  translationKey: z.string().regex(GUIDE_SLUG_RE, 'translationKey 只允许小写英文/数字/连字符').nullable().optional(),
  cover: guideCoverSchema.optional(),
  /** 相关文章：同语言内的 slug 列表（渲染时只保留真实存在且已发布的） */
  relatedArticles: z.array(z.string().regex(GUIDE_SLUG_RE)).optional(),
  sources: z.array(guideSourceSchema).optional()
}).refine(v => v.updatedAt >= v.publishedAt, {
  message: 'updatedAt 不能早于 publishedAt',
  path: ['updatedAt']
});

export type GuideSource = z.infer<typeof guideSourceSchema>;
export type GuideCover = z.infer<typeof guideCoverSchema>;
export type GuideFrontmatter = z.infer<typeof guideSchema>;

export type PriceTier = z.infer<typeof priceTierSchema>;
export type PeakOffpeak = z.infer<typeof peakOffpeakSchema>;
export type Model = z.infer<typeof modelSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolDetail = z.infer<typeof toolDetailSchema>;
export type Prompt = z.infer<typeof promptSchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type PageMeta = z.infer<typeof pageMetaSchema>;
export type PagesFile = z.infer<typeof pagesFileSchema>;
export type ComparesFile = z.infer<typeof comparesFileSchema>;
export type FxFile = z.infer<typeof fxFileSchema>;
export type FxRate = { rate?: number; source?: string; sourceUrl?: string; rateDate?: string; verifiedAt?: string };
export type Partner = z.infer<typeof partnerSchema>;
export type AdsConfig = z.infer<typeof adsFileSchema>;
