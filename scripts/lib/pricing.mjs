/**
 * 月成本计算与价格格式化：build.mjs 与全部校验脚本的唯一公式来源。
 * 口径与 /cost 页交互计算器默认值一致：日均 100 次调用 · 单次输入 2000 / 输出 800 Token · 错峰（低谷价）· 缓存命中率 30% · 月按 30 天 · 人民币。
 */

export const SAMPLE_PARAMS = Object.freeze({ calls: 100, inTok: 2000, outTok: 800, hit: 0.3 });

/** 默认用量参数下的示例月成本（错峰=低谷价；无公开缓存价按未命中价计） */
export function monthly(m, P = SAMPLE_PARAMS) {
  const b = m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut };
  const effIn = b.c == null ? b.i : P.hit * b.c + (1 - P.hit) * b.i;
  return P.calls * 30 * (P.inTok / 1e6) * effIn + P.calls * 30 * (P.outTok / 1e6) * b.o;
}

/** 通用月成本（可指定高峰/低谷、命中率、用量），供自检脚本复算 */
export function monthlyFull(m, { off = true, hit = 0.3, calls = 100, inTok = 2000, outTok = 800 } = {}) {
  const b = m.peakOffpeak
    ? (off
      ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
      : { i: m.peakOffpeak.peakIn, c: m.peakOffpeak.peakCache, o: m.peakOffpeak.peakOut })
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut };
  const effIn = b.c == null ? b.i : hit * b.c + (1 - hit) * b.i;
  const ic = calls * 30 * (inTok / 1e6) * effIn;
  const oc = calls * 30 * (outTok / 1e6) * b.o;
  return { t: ic + oc, ic, oc };
}

export const money = n => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const price = n => (n == null ? '未公开' : '¥' + n);

/** 展示精度（0.01 元）内的平局判定：|a-b| 小于半分视为持平 */
export const TIE_EPS = 0.005;
export function verdict(ca, cb) {
  if (Math.abs(ca - cb) < TIE_EPS) return 'tie';
  return ca < cb ? 'a' : 'b';
}
