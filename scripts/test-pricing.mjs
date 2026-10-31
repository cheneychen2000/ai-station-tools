/**
 * pricing 公式行为单测（业务实现已统一为 src/lib/domain/pricing.ts 单源，
 * 本脚本经 scripts/lib/pricing.mjs 稳定导入路径加载，Node 原生类型剥离直读 TS）。
 * 覆盖：价档选择/未核实语义、缓存命中加权、峰谷切换、多币种折算、持平判定、格式化。
 * 浏览器端镜像 assets/cost-core.js 的同源对拍由 check-en-pages E6 负责，此处不重复。
 */
import { createReporter } from './lib/report.mjs';
import { loadData } from './lib/manifest.mjs';
import { SAMPLE_PARAMS, monthly, monthlyFull, monthlyBase, tierFor, rateFor, fxEntry, toBase, verdict, money, price, modelCurrency, TIE_EPS } from './lib/pricing.mjs';

const R = createReporter('test-pricing');
const { models, fx } = loadData();
const byId = Object.fromEntries(models.map(m => [m.id, m]));

/* ---------- 价档选择 ---------- */
const mm = byId['minimax-m3'];
R.check('tierFor 分档边界：2000→低档、524288→低档、524289→最高档、无价档模型→null',
  tierFor(mm, 2000).upToInputTokens === 524288 &&
  tierFor(mm, 524288).upToInputTokens === 524288 &&
  tierFor(mm, 524289).upToInputTokens === null &&
  tierFor(byId['deepseek-v41-flash'], 2000) === null);
const luna = byId['gpt-6-luna'];
R.check('rateFor 未核实档位返回 unavailable 且价格为 null（不得当 0）',
  rateFor(luna, 278529).unavailable === true && rateFor(luna, 278529).i === null &&
  rateFor(luna, 2000).unavailable !== true && rateFor(luna, 2000).i === 0.1);
R.check('未核实档位月成本为 NaN（monthly）与 null（monthlyBase），不得产生虚假数字',
  Number.isNaN(monthly(luna, { ...SAMPLE_PARAMS, inTok: 300000 })) &&
  monthlyBase(luna, fx, { ...SAMPLE_PARAMS, inTok: 300000 }) === null);

/* ---------- 缓存命中加权与峰谷 ---------- */
const ds = byId['deepseek-v41-flash'];
const eff30 = 0.3 * 0.02 + 0.7 * 1; /* 低谷缓存价 0.02、低谷输入价 1 */
const v30 = monthlyFull(ds, { off: true, hit: 0.3, calls: 100, inTok: 2000, outTok: 800 });
R.check('错峰 30% 命中率：有效输入价 = 0.3×缓存 + 0.7×未命中（低谷口径）',
  Math.abs(v30.t - (100 * 30 * 0.002 * eff30 + 100 * 30 * 0.0008 * 4)) < 1e-9);
const v0 = monthlyFull(ds, { off: true, hit: 0, calls: 100, inTok: 2000, outTok: 800 });
R.check('命中率 0 时有效输入价 = 未命中价', Math.abs(v0.t - (100 * 30 * 0.002 * 1 + 100 * 30 * 0.0008 * 4)) < 1e-9);
const peak = monthlyFull(ds, { off: false, hit: 0.3, calls: 100, inTok: 2000, outTok: 800 });
R.check('高峰价切换生效（高峰成本 > 低谷成本）', peak.t > v30.t);
const noCache = byId['minimax-m3'];
R.check('无公开缓存价模型按未命中价计（命中率变化不影响）',
  monthlyFull(noCache, { off: true, hit: 0 }).t === monthlyFull(noCache, { off: true, hit: 0.9 }).t);

/* ---------- 多币种 ---------- */
R.check('fxEntry 核实规则：合法 USD 条目可用；CNY 基准 rate=1；未核实/缺失返回 null',
  fxEntry(fx, 'USD').rate === 6.718 && fxEntry(fx, 'CNY').rate === 1 &&
  fxEntry(fx, 'EUR') === null && fxEntry({ rates: {} }, 'USD') === null &&
  fxEntry({ rates: { USD_CNY: { rate: 6.7 } } }, 'USD') === null &&
  fxEntry({ rates: { USD_CNY: { rate: 0, rateDate: '2026-01-01', verifiedAt: '2026-01-01', source: 'x' } } }, 'USD') === null);
R.check('toBase 折算与未核实不折算', toBase(100, 'USD', fx) === 671.8 && toBase(100, 'EUR', fx) === null && toBase(100, 'CNY', fx) === 100);
R.check('USD 模型 monthlyBase 折算 CNY（glm 人民币 vs gemini 美元口径不同）',
  monthlyBase(byId['gemini-3-1-flash-lite'], fx) !== null &&
  Math.abs(monthlyBase(byId['gemini-3-1-flash-lite'], fx) - monthly(byId['gemini-3-1-flash-lite']) * 6.718) < 1e-9);

/* ---------- 持平与格式化 ---------- */
R.check('verdict：|a-b|<0.005 判 tie，否则取更低方',
  verdict(1, 1) === 'tie' && verdict(1, 1.004) === 'tie' && verdict(1, 1.006) === 'a' && verdict(2, 1) === 'b' && TIE_EPS === 0.005);
R.check('money/price 格式化：千分位两位小数、未公开、币种符号',
  money(1234.5) === '¥1,234.50' && money(13.84, 'USD') === '$13.84' &&
  price(null) === '未公开' && price(undefined) === '未公开' && price(0.8) === '¥0.8' &&
  modelCurrency(byId['gemini-3-1-flash-lite']) === 'USD' && modelCurrency(byId['glm-53']) === 'CNY');

R.summary();
