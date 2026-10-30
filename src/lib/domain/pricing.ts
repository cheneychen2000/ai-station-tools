/**
 * 月成本计算与价格格式化：全站唯一公式来源（页面、组件、端点共用）。
 * 口径与 /cost 页交互计算器默认值一致：日均 100 次调用 · 单次输入 2000 / 输出 800 Token · 错峰（低谷价）· 缓存命中率 30% · 月按 30 天 · 人民币。
 * 算法与迁移前 src/lib/pricing.mjs 逐行等价（仅增加类型约束，不改变任何计算含义）。
 */
import type { Model, FxFile, PriceTier } from '../data/schemas';

export interface SampleParams { calls: number; inTok: number; outTok: number; hit: number }
export const SAMPLE_PARAMS: Readonly<SampleParams> = Object.freeze({ calls: 100, inTok: 2000, outTok: 800, hit: 0.3 });

export interface Rate {
  i: number | null;
  c: number | null;
  o: number | null;
  tier: PriceTier | null;
  unavailable?: boolean;
}

/**
 * 按输入长度选择价档：priceTiers 为可选字段（升序，upToInputTokens=null 表示最高档）。
 * 无价档的模型返回 null，调用方回退到顶层 priceIn/priceOut（向后兼容）。
 */
export function tierFor(m: Model, inTok: number): PriceTier | null {
  if (!Array.isArray(m.priceTiers) || !m.priceTiers.length) return null;
  for (const t of m.priceTiers) {
    if (t.upToInputTokens == null || inTok <= t.upToInputTokens) return t;
  }
  return m.priceTiers[m.priceTiers.length - 1];
}

/** 取模型在某输入长度下的计费价（优先价档，回退顶层字段）；档位标记 unverified 或价格缺失时返回 unavailable（不得当 0） */
export function rateFor(m: Model, inTok: number): Rate {
  const t = tierFor(m, inTok);
  if (t && (t.unverified || typeof t.priceIn !== 'number' || typeof t.priceOut !== 'number')) {
    return { i: null, c: null, o: null, tier: t, unavailable: true };
  }
  return t
    ? { i: t.priceIn!, c: t.priceCacheHit == null ? null : t.priceCacheHit, o: t.priceOut!, tier: t }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut, tier: null };
}

/** 默认用量参数下的示例月成本（错峰=低谷价；无公开缓存价按未命中价计；价档按输入长度自动选择） */
export function monthly(m: Model, P: SampleParams = SAMPLE_PARAMS): number {
  const b = m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
    : rateFor(m, P.inTok);
  if (b.i == null || b.o == null) return NaN; /* 该输入长度档位价格未核实：无法计算，不得当 0 */
  const effIn = b.c == null ? b.i : P.hit * b.c + (1 - P.hit) * b.i;
  return P.calls * 30 * (P.inTok / 1e6) * effIn + P.calls * 30 * (P.outTok / 1e6) * b.o;
}

export interface MonthlyFullParams { off?: boolean; hit?: number; calls?: number; inTok?: number; outTok?: number }
export interface MonthlyBreakdown { t: number; ic: number; oc: number }

/** 通用月成本（可指定高峰/低谷、命中率、用量），供自检脚本复算 */
export function monthlyFull(m: Model, { off = true, hit = 0.3, calls = 100, inTok = 2000, outTok = 800 }: MonthlyFullParams = {}): MonthlyBreakdown {
  const b = m.peakOffpeak
    ? (off
      ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
      : { i: m.peakOffpeak.peakIn, c: m.peakOffpeak.peakCache, o: m.peakOffpeak.peakOut })
    : rateFor(m, inTok);
  /* ?? 0 与旧 JS 的 null 算术强转（null * n = 0）逐值等价，未核实档位的结果与旧实现一致 */
  const effIn = (b.c == null ? b.i : hit * b.c + (1 - hit) * (b.i ?? 0)) ?? 0;
  const ic = calls * 30 * (inTok / 1e6) * effIn;
  const oc = calls * 30 * (outTok / 1e6) * (b.o ?? 0);
  return { t: ic + oc, ic, oc };
}

export const money = (n: number, currency = 'CNY'): string => CURRENCY_SYMBOL[currency] + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const price = (n: number | null | undefined, currency = 'CNY'): string => (n == null ? '未公开' : CURRENCY_SYMBOL[currency] + n);

/* ---------- 多币种 ---------- */

export const BASE_CURRENCY = 'CNY'; /* 站内统一估算/比价口径 */
export const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$' };
export const CURRENCY_NAME: Record<string, string> = { CNY: '人民币', USD: '美元' };
export const modelCurrency = (m: Model): string => m.currency || 'CNY'; /* 缺失按 CNY（向后兼容） */

export interface FxEntry { rate: number; rateDate?: string | null; source?: string | null; sourceUrl?: string; verifiedAt?: string }

/** 取核实过的参考汇率；未核实（缺 rate/rateDate/verifiedAt/来源 或 rate<=0）返回 null，不得参与计算 */
export function fxEntry(fx: FxFile | null | undefined, from: string): FxEntry | null {
  if (from === BASE_CURRENCY) return { rate: 1, rateDate: null, source: null };
  const r = fx && fx.rates && fx.rates[`${from}_${BASE_CURRENCY}`];
  if (!r || typeof r.rate !== 'number' || !(r.rate > 0) || !r.rateDate || !r.verifiedAt || !r.source) return null;
  return r as FxEntry;
}

/** 折算为站内基础币种（CNY）；汇率未核实时返回 null（调用方须标记无法折算，不得静默比较） */
export function toBase(n: number, currency: string, fx: FxFile | null | undefined): number | null {
  const e = fxEntry(fx, currency);
  return e ? n * e.rate : null;
}

/** 模型默认用量月成本折算为 CNY；该输入长度档位价格未核实或汇率未核实时返回 null */
export function monthlyBase(m: Model, fx: FxFile | null | undefined, P: SampleParams = SAMPLE_PARAMS): number | null {
  const v = monthly(m, P);
  if (Number.isNaN(v)) return null;
  return toBase(v, modelCurrency(m), fx);
}

/** 展示精度（0.01 元）内的平局判定：|a-b| 小于半分视为持平 */
export const TIE_EPS = 0.005;
export type Verdict = 'a' | 'b' | 'tie';
export function verdict(ca: number, cb: number): Verdict {
  if (Math.abs(ca - cb) < TIE_EPS) return 'tie';
  return ca < cb ? 'a' : 'b';
}
