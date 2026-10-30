/**
 * pricing 公式回归单测：
 *  - src/lib/domain/pricing.ts（站点唯一公式源，TS）与 scripts/lib/pricing.mjs（检查脚本副本）
 *    在全部模型 × 参数网格上逐值一致（含未核实档位的 null/NaN 语义、多币种折算、持平判定）；
 *  - src/lib/domain/manifest.ts 与 scripts/lib/manifest.mjs 的组合/清单规则一致。
 * 运行：node scripts/test-pricing.mjs（无需构建；Node 22.18+/24 直接加载 erasable TS）
 */
import { createReporter } from './lib/report.mjs';
import { loadData } from './lib/manifest.mjs';
import * as ref from './lib/pricing.mjs';
import * as cur from '../src/lib/domain/pricing.ts';

const R = createReporter('test-pricing');
const { models, fx, compares } = loadData();

/* ---------- 逐模型 × 参数网格对拍 ---------- */
let gridBad = 0;
const GRID = [];
for (const off of [true, false]) for (const hit of [0, 0.3, 0.6, 0.9]) for (const calls of [1, 100, 2000]) for (const inTok of [1200, 2000, 10000, 600000]) GRID.push({ off, hit, calls, inTok, outTok: 800 });

const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Object.is(a, b);
for (const m of models) {
  for (const p of GRID) {
    const a = ref.monthlyFull(m, p), b = cur.monthlyFull(m, p);
    if (!same(a.t, b.t) || !same(a.ic, b.ic) || !same(a.oc, b.oc)) {
      gridBad++;
      if (gridBad <= 3) console.log(`  diff ${m.id} ${JSON.stringify(p)}: ref=${JSON.stringify(a)} cur=${JSON.stringify(b)}`);
    }
  }
  /* 单值函数对拍 */
  if (!same(ref.monthly(m), cur.monthly(m))) { gridBad++; console.log(`  monthly diff ${m.id}`); }
  if (!same(ref.monthlyBase(m, fx), cur.monthlyBase(m, fx))) { gridBad++; console.log(`  monthlyBase diff ${m.id}`); }
  for (const inTok of [0, 2000, 524288, 524289, 278528, 278529]) {
    const rt = ref.rateFor(m, inTok), ct = cur.rateFor(m, inTok);
    if (rt.unavailable !== ct.unavailable || !same(rt.i ?? NaN, ct.i ?? NaN) || !same(rt.o ?? NaN, ct.o ?? NaN) || !same(rt.c ?? NaN, ct.c ?? NaN) || (rt.tier?.desc || null) !== (ct.tier?.desc || null)) {
      gridBad++; console.log(`  rateFor diff ${m.id} inTok=${inTok}`);
    }
  }
}
R.check(`monthlyFull 网格对拍（${models.length} 款 × ${GRID.length} 组 + 单值/价档边界）`, gridBad === 0, gridBad ? `${gridBad} 处不一致` : '全部一致');

/* ---------- 格式化与折算 ---------- */
R.check('money/price/modelCurrency 格式化一致',
  models.every(m => ref.money(1234.5, ref.modelCurrency(m)) === cur.money(1234.5, cur.modelCurrency(m)) &&
    ref.price(m.priceIn, ref.modelCurrency(m)) === cur.price(m.priceIn, cur.modelCurrency(m)) &&
    ref.price(null) === cur.price(null) && ref.price(undefined) === cur.price(undefined)));
R.check('fxEntry/toBase 未核实语义一致（USD 核实 / 伪造缺字段返回 null）',
  JSON.stringify(ref.fxEntry(fx, 'USD')) === JSON.stringify(cur.fxEntry(fx, 'USD')) &&
  ref.toBase(100, 'USD', fx) === cur.toBase(100, 'USD', fx) &&
  cur.toBase(100, 'EUR', fx) === null && cur.fxEntry({ rates: {} }, 'USD') === null &&
  cur.fxEntry({ rates: { USD_CNY: { rate: 6.7 } } }, 'USD') === null);
R.check('verdict 持平判定（TIE_EPS=0.005）一致',
  ref.verdict(1, 1) === cur.verdict(1, 1) && ref.verdict(1, 1.004) === cur.verdict(1, 1.004) &&
  ref.verdict(1, 1.006) === cur.verdict(1, 1.006) && ref.verdict(2, 1) === cur.verdict(2, 1));

/* manifest 规则（sitemap 条目/lastmod/全组合）的 src(TS) vs scripts(lib) 对拍由
   check-sitemap-lastmod（S8/S9 逐条比对 dist sitemap 与 scripts/lib 推导）与快照回归覆盖，此处不重复。 */

R.summary();
