/**
 * 价格单元格纯文本构建（中英共用同一函数，en 仅换文案）。
 * 返回的是纯文本（无 HTML），由组件负责插值转义；与迁移前 render.mjs
 * 的 cellPrice/cellPriceEn/guidePriceCells 输出逐字一致。
 */
import { price, modelCurrency } from './pricing';
import { enTierDesc } from '../i18n/dictionaries.mjs';
import type { Model } from '../data/schemas';

export type CellKind = 'in' | 'out' | 'cache';

const EN_PEAK_WINDOW = (s: string): string => s.replace(/工作日/g, 'Weekdays').replace(/、/g, ', ').replace(/与/g, ' & ');

const tierCell = (m: Model, kind: CellKind, en: boolean): string => {
  if (!m.priceTiers) return '';
  const key = kind === 'in' ? 'priceIn' : kind === 'out' ? 'priceOut' : 'priceCacheHit';
  const cur = modelCurrency(m);
  if (kind === 'cache' && m.priceTiers.every(t => t.priceCacheHit == null)) return en ? 'Not published' : '未公开';
  return m.priceTiers
    .map(t => {
      const label = en ? enTierDesc(t.desc) : t.desc;
      if (t.unverified) return `${label} ${en ? 'not published' : '未公开'}`;
      const v = (t as Record<string, number | null>)[key];
      return `${label} ${v == null ? (en ? 'not published' : '未公开') : price(v, cur)}`;
    })
    .join('　');
};

const peakCell = (m: Model, kind: CellKind, en: boolean): string => {
  const p = m.peakOffpeak!;
  const cur = modelCurrency(m);
  const hi = en ? 'Peak' : '高峰';
  const lo = en ? 'off-peak' : '低谷';
  if (kind === 'in') return `${hi} ${price(p.peakIn, cur)} / ${lo} ${price(p.offIn, cur)}`;
  if (kind === 'out') return `${hi} ${price(p.peakOut, cur)} / ${lo} ${price(p.offOut, cur)}`;
  return `${hi} ${price(p.peakCache, cur)} / ${lo} ${price(p.offCache, cur)}`;
};

const singleCell = (m: Model, kind: CellKind, en: boolean): string => {
  const cur = modelCurrency(m);
  if (kind === 'in') return price(m.priceIn, cur);
  if (kind === 'out') return price(m.priceOut, cur);
  if (m.priceCacheHit == null) return en ? 'Not published' : '未公开';
  return price(m.priceCacheHit, cur);
};

/** 对比表/参考表的价格单元格文本（分档 → 分时段 → 单一价 三态） */
export const cellPriceText = (m: Model, kind: CellKind, en: boolean): string =>
  m.priceTiers ? tierCell(m, kind, en) : m.peakOffpeak ? peakCell(m, kind, en) : singleCell(m, kind, en);

/** 摘要区事实性单价对比（错峰低谷/单一价口径），与 lowPrices 同义 */
export const lowPrices = (m: Model): { i: number; c: number | null; o: number } =>
  m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut };

export const fmtDiff = (n: number): string => '¥' + (Math.round(Math.abs(n) * 100) / 100);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- 模型详情页价格表（分档 / 分时段 / 单一价 三态 + 附加行） ---------- */

export interface PriceTableRow {
  label: string;
  text: string;
  /** 行首图标（分档规则/分时段行），由组件渲染 SVG */
  icon?: 'yes' | 'no';
}

/** 详情页价格表面板行（与迁移前 priceTable/enPriceRows 输出逐字一致，图标单独结构化） */
export function priceTableRows(m: Model, en: boolean, fxNoteText: string | null): PriceTableRow[] {
  const cur = modelCurrency(m);
  const rows: PriceTableRow[] = [];
  if (m.priceTiers) {
    rows.push(
      { label: en ? 'Input (cache miss)' : '输入价（未命中）', text: m.priceTiers.map(t => `${en ? enTierDesc(t.desc) : t.desc} ${t.unverified ? (en ? 'rate not published' : '费率未公开') : price(t.priceIn, cur)}`).join('　') },
      { label: en ? 'Output' : '输出价', text: m.priceTiers.map(t => `${en ? enTierDesc(t.desc) : t.desc} ${t.unverified ? (en ? 'rate not published' : '费率未公开') : price(t.priceOut, cur)}`).join('　') },
      { label: en ? 'Cache hit' : '缓存命中价', text: m.priceTiers.every(t => t.priceCacheHit == null) ? (en ? 'Not published' : '未公开') : m.priceTiers.map(t => t.priceCacheHit == null ? (en ? 'not published' : '未公开') : price(t.priceCacheHit, cur)).join('　') },
      { label: en ? 'Tiered pricing' : '分档规则', icon: 'yes', text: en ? 'Billed by input length; the cost calculator selects the tier automatically' : '按输入长度分档，计算器按你的输入长度自动选档' }
    );
  } else if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    const hi = en ? 'Peak' : '高峰';
    const lo = en ? 'off-peak' : '低谷';
    rows.push(
      { label: en ? 'Input (cache miss)' : '输入价（未命中）', text: `${hi} ${price(p.peakIn, cur)} / ${lo} ${price(p.offIn, cur)}` },
      { label: en ? 'Output' : '输出价', text: `${hi} ${price(p.peakOut, cur)} / ${lo} ${price(p.offOut, cur)}` },
      { label: en ? 'Cache hit' : '缓存命中价', text: `${hi} ${price(p.peakCache, cur)} / ${lo} ${price(p.offCache, cur)}` },
      { label: en ? 'Time-based pricing' : '分时段', icon: 'yes', text: en ? `Peak window: ${EN_PEAK_WINDOW(p.peakWindow)}; all other times use the off-peak rate (about half of peak)` : `高峰时段 = ${p.peakWindow}，其余时间为低谷价` }
    );
  } else {
    rows.push(
      { label: en ? 'Input (cache miss)' : '输入价（未命中）', text: price(m.priceIn, cur) },
      { label: en ? 'Output' : '输出价', text: price(m.priceOut, cur) },
      { label: en ? 'Cache hit' : '缓存命中价', text: en ? (m.priceCacheHit == null ? 'Not published' : price(m.priceCacheHit, cur)) : price(m.priceCacheHit, cur) },
      { label: en ? 'Time-based pricing' : '分时段', icon: 'no', text: en ? 'Single price around the clock' : '单一价格' }
    );
  }
  /* 中文表：缓存写入价 + 计价币种附加行；英文表：Billing currency 行（与旧模板一致） */
  if (!en && m.priceCacheWrite != null) {
    rows.push({ label: '缓存写入价', text: `${price(m.priceCacheWrite, cur)}（30 分钟 / 5 分钟档，未计入月成本估算）` });
  }
  if (!en && cur === 'USD') {
    rows.push({ label: '计价币种', text: `美元（USD / 百万 Token）${fxNoteText ? `；人民币折算参考：${fxNoteText}` : '；参考汇率未核实，暂不提供折算'}` });
  }
  if (en) {
    rows.push({ label: 'Billing currency', text: `${cur === 'USD' ? 'USD (US dollars)' : 'CNY (Chinese yuan)'} — the vendor's original billing currency, not converted` });
  }
  return rows;
}

/* ---------- 多行价格单元格（<br> 分行，组件逐行渲染） ---------- */

/** 指南/成本参考表的价格单元格：返回行数组（空数组表示"未公开"占位由调用方决定） */
export function priceCellLines(m: Model, kind: CellKind, en: boolean): string[] {
  const cur = modelCurrency(m);
  if (m.priceTiers) {
    if (kind === 'cache' && m.priceTiers.every(t => t.priceCacheHit == null)) return [en ? 'Not published' : '未公开'];
    return m.priceTiers.map(t => {
      if (t.unverified) return `${en ? enTierDesc(t.desc) : t.desc} ${en ? 'not published' : '未公开'}`;
      const key = kind === 'in' ? 'priceIn' : kind === 'out' ? 'priceOut' : 'priceCacheHit';
      const v = (t as Record<string, number | null>)[key];
      return `${en ? enTierDesc(t.desc) : t.desc} ${v == null ? (en ? 'not published' : '未公开') : price(v, cur)}`;
    });
  }
  if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    if (kind === 'in') return [en ? `Peak ${price(p.peakIn, cur)}` : `高峰 ${price(p.peakIn, cur)}`, en ? `Off-peak ${price(p.offIn, cur)}` : `低谷 ${price(p.offIn, cur)}`];
    if (kind === 'out') return [en ? `Peak ${price(p.peakOut, cur)}` : `高峰 ${price(p.peakOut, cur)}`, en ? `Off-peak ${price(p.offOut, cur)}` : `低谷 ${price(p.offOut, cur)}`];
    return [en ? `Peak ${price(p.peakCache, cur)}` : `高峰 ${price(p.peakCache, cur)}`, en ? `Off-peak ${price(p.offCache, cur)}` : `低谷 ${price(p.offCache, cur)}`];
  }
  if (kind === 'in') return [price(m.priceIn, cur)];
  if (kind === 'out') return [price(m.priceOut, cur)];
  return m.priceCacheHit == null ? [en ? 'Not published' : '未公开'] : [price(m.priceCacheHit, cur)];
}
