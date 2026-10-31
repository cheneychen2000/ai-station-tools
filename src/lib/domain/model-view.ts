/**
 * 模型详情页视图构建：元数据（title/description/JSON-LD）与纯数据内容
 * （lede、同厂商、相关对比链接、EN 成本估算面板数值）。
 * 模板与 HTML 由组件负责；此处输出的文本为原始值（组件插值时由 Astro 转义）。
 * 算法/文案与迁移前 render.mjs 的 modelDetail/modelDetailEn 逐字一致。
 */
import { SITE, BRAND } from '../config';
import { price, money, modelCurrency, SAMPLE_PARAMS as P } from './pricing';
import { round2 } from './price-cells';
import { fxNote, enFxNote } from './fx-notes';
import { breadcrumb } from '../seo/structured-data';
import { jsStr, safeUrl } from '../utils/escape';
import { EN_MODEL_COPY, EN_MODALITY, EN_FEATURE } from '../i18n/dictionaries.mjs';
import { enModelName, enSrcLabel } from '../i18n/helpers';
import type { Model, ComparesFile, FxFile } from '../data/schemas';

export interface CompareLink { href: string; text: string }

/** 相关对比：同厂商兄弟 + compares.json extraPairs 中含该模型的组合（每模型至多 5 条） */
export function modelCompareLinks(m: Model, models: Model[], compares: ComparesFile, en: boolean): CompareLink[] {
  const name = en ? enModelName(m) : m.name;
  const out: CompareLink[] = [];
  const seen = new Set<string>();
  const push = (x: string, y: string) => {
    const [nx, ny] = [x, y].sort();
    const key = `${nx}/${ny}`;
    if (seen.has(key)) return;
    const om = models.find(mm => mm.id === (x === m.id ? y : x));
    if (!om) return;
    seen.add(key);
    out.push({
      href: `../../compare/${nx}/${ny}/`,
      text: `${name} vs ${en ? enModelName(om) : om.name}`
    });
  };
  for (const s of models.filter(x => x.vendor === m.vendor && x.id !== m.id)) push(m.id, s.id);
  for (const [x, y] of (compares.extraPairs || []).filter(([x, y]) => x === m.id || y === m.id).slice(0, 4)) push(x, y);
  return out.slice(0, 5);
}

export interface ModelDetailView {
  /** 展示名（英文页经 enModelName 字典） */
  displayName: string;
  title: string;
  desc: string;
  canonicalPath: string;
  jsonld: Array<Record<string, unknown>>;
  crumb: string;
  active: string;
  inlineScript: string;
  lede: string;
  modText: string;
  featText: string;
  curName: string;
  vendor: string;
  srcUrl: string | null;
  srcLabel: string;
  siblings: Model[];
  compareLinks: CompareLink[];
  priceNote: string | null;
  /* 仅英文页：站点口径月成本面板（原始实现按顶层字段计，刻意不回退价档/峰谷） */
  enCost: {
    /** 假设说明（"Same formula as the " 结尾，其后由组件渲染 cost calculator 链接） */
    assumptionsLead: string;
    assumptionsTrail: string;
    effInLine: string;
    inCostLine: string;
    outCostLine: string;
    totalLine: string;
    useNote: string;
    vendorEn: string;
    positioning: string;
  } | null;
}

export function buildModelDetail(m: Model, models: Model[], compares: ComparesFile, en: boolean): ModelDetailView {
  const cur = modelCurrency(m);
  const src = safeUrl(m.sourceUrl);
  const modText = (m.modalities || []).map(x => (en ? EN_MODALITY[x] || x : x)).join(en ? ', ' : '、');
  const featText = (m.features || []).map(x => (en ? EN_FEATURE[x] || x : x)).join(en ? ', ' : '、');
  const srcLabel = en ? enSrcLabel(m) : m.sourceName;

  let lede: string;
  let enCost: ModelDetailView['enCost'] = null;
  let vendorLabel = m.vendor;

  if (!en) {
    const curName = cur === 'USD' ? '美元' : '人民币';
    lede = `${m.name} 是${m.vendor}推出的大模型，支持${modText}，上下文窗口 ${m.context}K。API 定价（${curName}刊例原价）：输入 ${price(m.priceIn, cur)}/百万Token、输出 ${price(m.priceOut, cur)}/百万Token${m.priceCacheHit != null ? `、缓存命中 ${price(m.priceCacheHit, cur)}` : ''}${m.peakOffpeak ? '，分时段定价（低谷价约为高峰一半）' : ''}。数据核验日期 ${m.verifiedAt}，来源可点击查验。`;
  } else {
    const meta = EN_MODEL_COPY[m.id];
    if (!meta) throw new Error(`EN_MODEL_COPY missing for ${m.id}`);
    vendorLabel = meta.vendorEn;
    lede = meta.positioning;
    /* 与旧版同一公式：按顶层字段计（不回退价档/峰谷），展示口径在面板说明中已声明 */
    const effIn = m.priceCacheHit == null ? m.priceIn : P.hit * m.priceCacheHit + (1 - P.hit) * m.priceIn;
    const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
    const outCost = P.calls * 30 * (P.outTok / 1e6) * m.priceOut;
    const total = Math.round((inCost + outCost) * 100) / 100;
    enCost = {
      vendorEn: meta.vendorEn,
      positioning: meta.positioning,
      useNote: meta.useNote,
      assumptionsLead: `Site calculation, not a vendor quote. Assumptions: ${P.calls} calls/day · ${P.inTok} input / ${P.outTok} output tokens per call · 30-day month · ${Math.round(P.hit * 100)}% cache hit rate${m.peakOffpeak ? ' · off-peak rates' : ''}. Same formula as the `,
      assumptionsTrail: '.',
      effInLine: m.priceCacheHit == null
        ? `No published cache price; input billed at ${price(m.priceIn, cur)}`
        : `${Math.round(P.hit * 100)}% × ${price(m.priceCacheHit, cur)} (cache hit) + ${Math.round((1 - P.hit) * 100)}% × ${price(m.priceIn, cur)} (standard) = ${round2(effIn)} ${cur === 'USD' ? 'USD' : 'CNY'}/1M tokens`,
      inCostLine: `${P.calls} × 30 × (${P.inTok} ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost), cur)}`,
      outCostLine: `${P.calls} × 30 × (${P.outTok} ÷ 1,000,000) × ${price(m.priceOut, cur)} = ${money(round2(outCost), cur)}`,
      totalLine: money(total, cur)
    };
  }

  const siblings = models.filter(x => x.vendor === m.vendor && x.id !== m.id);
  const compareLinks = modelCompareLinks(m, models, compares, en);
  const displayName = en ? enModelName(m) : m.name;

  const title = en
    ? `${displayName} API Pricing, Context Window and Specs | ${BRAND}`
    : (typeof m.seoTitle === 'string' && m.seoTitle.trim()) ? m.seoTitle : `${m.name} 价格与参数档案 - ${m.vendor} | ${BRAND}`;
  const desc = en
    ? `${displayName} (${vendorLabel}) API pricing: input ${price(m.priceIn, cur)}, output ${price(m.priceOut, cur)} per 1M tokens (${cur === 'USD' ? 'USD' : 'CNY'}), ${m.context}K context, modalities: ${modText}. Official source linked, verified ${m.verifiedAt}.`
    : (typeof m.seoDescription === 'string' && m.seoDescription.trim()) ? m.seoDescription : `${m.name}（${m.vendor}）API 价格（${modelCurrency(m) === 'USD' ? '美元' : '人民币'}）：输入 ${price(m.priceIn, modelCurrency(m))}/输出 ${price(m.priceOut, modelCurrency(m))} 每百万Token，上下文 ${m.context}K，支持${modText}。数据核验于 ${m.verifiedAt}。`;

  /* 键序与迁移前 JSON-LD 逐字一致（结构化数据 diff 即回归信号） */
  const ld: Record<string, unknown> = en
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: displayName,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'API',
        inLanguage: 'en',
        description: desc,
        url: `${SITE}/en/models/${m.id}/`,
        ...(src ? { sameAs: src } : {})
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: m.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'API',
        description: lede,
        url: `${SITE}/models/${m.id}/`,
        ...(src ? { sameAs: src } : {})
      };
  /* 不输出 Offer：priceIn 是每百万 Token 的 API 计费单价，不是软件购买价格 */

  const jsonld = en
    ? [
        ld,
        breadcrumb([{ name: 'English Home', path: '/en/' }, { name: displayName, path: `/en/models/${m.id}/` }])
      ]
    : [
        ld,
        breadcrumb([{ name: '首页', path: '/' }, { name: '模型库', path: '/models/' }, { name: m.name, path: `/models/${m.id}/` }])
      ];

  return {
    displayName,
    title,
    desc,
    canonicalPath: `${en ? '/en' : ''}/models/${m.id}/`,
    jsonld,
    crumb: en
      ? `/ <a href="../../" style="color:inherit">English Home</a> / ${displayName}`
      : `/ <a href="../" style="color:inherit">模型库</a> / ${m.name}`,
    active: 'models',
    inlineScript: `  <script>window.track('model_view', { id: ${jsStr(m.id)}${en ? ", lang: 'en'" : ''} });</script>`,
    lede,
    modText,
    featText,
    curName: cur === 'USD' ? (en ? 'USD' : '美元') : (en ? 'CNY' : '人民币'),
    vendor: vendorLabel,
    srcUrl: src,
    srcLabel,
    siblings,
    compareLinks,
    priceNote: m.priceNote || null,
    enCost
  };
}

/** 模型目录页排序口径说明文案（fx.json 同一事实数据） */
export function modelToolbarNote(fx: FxFile, en: boolean): string {
  if (en) {
    const e = enFxNote(fx, 'USD');
    return `Price sorting converts each model's estimated monthly cost at default usage (same basis as the cost calculator) to CNY${e ? ` (${e}, indicative only)` : ' (reference rate unverified)'}; models with unverified rates are excluded from price sorting.`;
  }
  const e = fxNote(fx, 'USD');
  return `价格排序按默认用量估算月成本（与成本计算器同口径）统一折算为人民币${e ? `（${e}，折算仅供参考）` : '（参考汇率未核实，美元模型不参与价格排序）'}；费率未核实的模型不参与价格排序。`;
}
