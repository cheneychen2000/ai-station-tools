/**
 * 文章分类显示名（稳定分类 ID → 中/英文案）。
 * 分类 ID 由 schema 约束（GUIDE_CATEGORIES），此处只负责展示名，避免页面上散落条件判断。
 */
import type { GuideCategory } from '../data/schemas';

export const CATEGORY_LABELS: Record<GuideCategory, { zh: string; en: string }> = {
  'guide': { zh: '指南', en: 'Guide' },
  'tutorial': { zh: '教程', en: 'Tutorial' },
  'case-study': { zh: '案例', en: 'Case study' },
  'analysis': { zh: '分析', en: 'Analysis' },
  'cost-optimization': { zh: '成本优化', en: 'Cost optimization' },
  'model-selection': { zh: '模型选型', en: 'Model selection' }
};

/** 按语言取分类展示名（未知 ID 原样返回，供旧数据兜底） */
export function categoryLabel(id: string, lang: 'zh-CN' | 'en'): string {
  const entry = CATEGORY_LABELS[id as GuideCategory];
  if (!entry) return id;
  return lang === 'en' ? entry.en : entry.zh;
}

/** 文章页/JSON-LD 的 schema.org 类型映射 */
export function articleSchemaType(id: string): 'TechArticle' | 'Article' {
  return id === 'case-study' || id === 'analysis' ? 'Article' : 'TechArticle';
}
