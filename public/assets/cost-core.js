/**
 * Reflex Hub · 中英成本计算器共享计算核心（浏览器 + Node 双端可用）。
 * 公式唯一实现源：/cost/ 与 /en/cost/ 两页均调用本文件，禁止在页面脚本内复制公式。
 * 口径与 scripts/lib/pricing.mjs 完全一致（构建期校验 scripts/check-en-pages.mjs 逐模型对拍）：
 *   月成本 = 调用/天 × 30 天 × (输入Token ÷ 1e6 × 输入有效单价 + 输出Token ÷ 1e6 × 输出单价)
 *   输入有效单价 = 命中率 × 缓存命中价 + (1 − 命中率) × 未命中价
 *   分时段模型按高峰/低谷整组取价；分档模型按输入长度选档；未核实档位返回 null（不当 0、不套低档）。
 */
(function (g) {
  'use strict';

  /* 按输入长度选档（priceTiers 升序，upToInputTokens=null 为最高档）；无价档返回 null */
  function tierPrice(m, inTok) {
    if (!m.priceTiers || !m.priceTiers.length) return null;
    for (var i = 0; i < m.priceTiers.length; i++) {
      var t = m.priceTiers[i];
      if (t.upToInputTokens == null || inTok <= t.upToInputTokens) return t;
    }
    return m.priceTiers[m.priceTiers.length - 1];
  }

  /**
   * 有效单价：opts = { offpeak: bool, inTok: number }（分时段模型按 offpeak 取高峰/低谷整组价）。
   * 返回 { effIn, output }；价格缺失或档位未核实时返回 null。
   */
  function effectiveInputPrice(m, opts, hitRatio) {
    var base;
    if (m.peakOffpeak) {
      var p = m.peakOffpeak;
      base = opts.offpeak
        ? { input: p.offIn, cache: p.offCache, output: p.offOut }
        : { input: p.peakIn, cache: p.peakCache, output: p.peakOut };
    } else {
      var t = tierPrice(m, opts.inTok);
      if (t && t.unverified) return null; /* 该输入长度档位费率未核实：不套用低档价格 */
      base = { input: t ? t.priceIn : m.priceIn, cache: t ? t.priceCacheHit : m.priceCacheHit, output: t ? t.priceOut : m.priceOut };
    }
    if (base.input == null || base.output == null) return null;
    var effIn = (base.cache == null) ? base.input : hitRatio * base.cache + (1 - hitRatio) * base.input;
    return { effIn: effIn, output: base.output };
  }

  /* 月成本：pr 为 effectiveInputPrice 的返回；结果含输入/输出分项，便于结果页展示 */
  function monthlyCost(pr, calls, inTok, outTok) {
    var inCost = calls * 30 * (inTok / 1000000) * pr.effIn;
    var outCost = calls * 30 * (outTok / 1000000) * pr.output;
    return { total: inCost + outCost, inCost: inCost, outCost: outCost };
  }

  var api = { tierPrice: tierPrice, effectiveInputPrice: effectiveInputPrice, monthlyCost: monthlyCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.CostCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
