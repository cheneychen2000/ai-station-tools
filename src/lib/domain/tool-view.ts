/**
 * 工具详情页视图构建：元数据 + 纯数据内容（与迁移前 render.mjs 的 toolDetail/toolDetailEn 逐字一致）。
 */
import { SITE, BRAND } from '../config';
import { isToolIndexable } from './manifest';
import { breadcrumb } from '../seo/structured-data';
import { safeUrl } from '../utils/escape';
import { EN_TOOL, EN_TOOL_CATEGORY, EN_TOOL_FREE } from '../i18n/dictionaries.mjs';
import { enToolName } from '../i18n/helpers';
import type { Tool } from '../data/schemas';

export interface ToolDetailView {
  title: string;
  desc: string;
  canonicalPath: string;
  robots: string | null;
  jsonld: Array<Record<string, unknown>>;
  crumb: string;
  active: string;
  name: string;
  tagline: string;
  freeLabel: string;
  badgeClass: string;
  lede: string;
  category: string;
  scene: string;
  officialUrl: string | null;
  related: Array<{ id: string; name: string }>;
  detailSections: Array<{ h: string; body: string }>;
  detailSources: Array<{ label: string; url: string | null; verifiedAt: string }>;
}

export function buildToolDetail(t: Tool, tools: Tool[], en: boolean): ToolDetailView {
  const meta = en ? EN_TOOL[t.id] : null;
  if (en && !meta) throw new Error(`EN_TOOL missing for ${t.id}`);
  const indexable = isToolIndexable(t);
  const u = safeUrl(t.url);
  const name = en ? enToolName(t) : t.name;
  const tagline = en ? meta!.tagline : t.tagline;
  const category = en ? (EN_TOOL_CATEGORY[t.category] || t.category) : t.category;
  const freeLabel = en ? (EN_TOOL_FREE[t.free] || t.free) : t.free;
  const scene = en ? meta!.scene : t.scene;

  const lede = en
    ? `${name} is a ${category} AI tool — ${tagline}. Typical use: ${scene}. Pricing model: ${freeLabel}. Information verified ${t.verifiedAt}; check the official site for current details.`
    : `${t.name} 是一款${t.category}类 AI 工具——${t.tagline}。适用场景：${t.scene}。收费模式：${t.free}。信息核验日期 ${t.verifiedAt}，以官网实际为准。`;

  /* 键序与迁移前 JSON-LD 逐字一致 */
  const ld: Record<string, unknown> = en
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        inLanguage: 'en',
        description: lede,
        url: `${SITE}/en/tools/${t.id}/`,
        ...(u ? { sameAs: u } : {})
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        description: lede,
        url: `${SITE}/tools/${t.id}/`,
        ...(u ? { sameAs: u } : {})
      };
  /* 仅"免费"工具可准确表达 Offer price=0；免费增值/付费无法用单一价格准确表达时不输出 Offer */
  if (t.free === '免费') {
    ld.offers = { '@type': 'Offer', price: '0', priceCurrency: 'CNY', description: en ? 'Free to use' : '免费使用' };
  }

  const relatedTools = tools.filter(x => x.category === t.category && x.id !== t.id).slice(0, 4);

  return {
    title: en
      ? `${name} - ${category} AI Tool | ${BRAND}`
      : `${t.name} - ${t.category}类 AI 工具介绍 | ${BRAND}`,
    desc: en
      ? `${name}: ${meta!.tagline}. Typical use: ${meta!.scene}. Pricing model: ${EN_TOOL_FREE[t.free] || t.free}.`
      : `${t.name}：${t.tagline}。适用场景：${t.scene}。收费模式：${t.free}。`,
    canonicalPath: `${en ? '/en' : ''}/tools/${t.id}/`,
    robots: indexable ? null : 'noindex,follow',
    jsonld: [
      ld,
      breadcrumb([
        { name: en ? 'Home' : '首页', path: en ? '/en/' : '/' },
        { name: en ? 'Tool directory' : '工具库', path: en ? '/en/tools/' : '/tools/' },
        { name, path: `${en ? '/en' : ''}/tools/${t.id}/` }
      ])
    ],
    crumb: en
      ? `/ <a href="../" style="color:inherit">Tool directory</a> / ${name}`
      : `/ <a href="../" style="color:inherit">工具库</a> / ${t.name}`,
    active: 'tools',
    name,
    tagline,
    freeLabel,
    badgeClass: `free-${t.free}`,
    lede,
    category,
    scene,
    officialUrl: u,
    related: relatedTools.map(r => ({ id: r.id, name: en ? enToolName(r) : r.name })),
    detailSections: (t.detail?.sections || []).map(s => ({ h: s.h, body: s.body })),
    detailSources: (t.detail?.sources || []).map(s => ({ label: s.label, url: safeUrl(s.url), verifiedAt: s.verifiedAt }))
  };
}

/** 工具目录卡片 tagline 占位符填充（{modelCount}/{compareCount} 由真实数据替换） */
export const fillToolTagline = (s: string, modelCount: number, compareCount: number): string =>
  s.replace(/\{modelCount\}/g, String(modelCount)).replace(/\{compareCount\}/g, String(compareCount));
