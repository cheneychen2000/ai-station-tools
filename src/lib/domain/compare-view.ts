/**
 * 对比详情页视图构建（中英同一函数，en 仅换文案）：
 * 表格行（纯文本 + 结构化字段）、对比摘要（纯文本数组）、SEO 元数据。
 * 公式与判定逻辑与迁移前 render.mjs 的 compareDetail/compareDetailEn 逐字一致：
 * 同一份 models.json、同一 pricing 公式、同一 a<b 归一、同一跨币种折算与持平口径。
 * 输出文本为原始值，HTML 由组件负责。
 */
import { BRAND } from '../config';
import { monthly, money, price, modelCurrency, toBase, verdict, TIE_EPS, type Verdict } from './pricing';
import { cellPriceText, lowPrices, fmtDiff } from './price-cells';
import { breadcrumb } from '../seo/structured-data';
import { jsStr, safeUrl } from '../utils/escape';
import { EN_MODALITY, EN_FEATURE } from '../i18n/dictionaries.mjs';
import { enModelName, enSrcLabel, enVendorLabel } from '../i18n/helpers';
import type { Model, FxFile } from '../data/schemas';

const EN_PEAK_WINDOW = (s: string): string => s.replace(/工作日/g, 'Weekdays').replace(/、/g, ', ').replace(/与/g, ' & ');

export type CmpVerdict = Verdict | 'na';

export interface CompareRow {
  label: string;
  a: string;
  b: string;
  /** 是否为示例月成本行（胜出高亮只作用于该行） */
  cost?: boolean;
  /** 示例月成本是否持平（单元格尾部追加"（持平）"） */
  costTie?: boolean;
  /** 跨币种时的折算注记（仅 cost 行使用，位于单元格 br 之后） */
  aCny?: string | null;
  bCny?: string | null;
  /** 分时段行：是否分时段定价 + 高峰窗口文案 */
  aPeak?: { window: string } | null;
  bPeak?: { window: string } | null;
  /** 来源行：链接化所需的结构化数据 */
  aSrc?: { url: string | null; label: string };
  bSrc?: { url: string | null; label: string };
}

export interface CompareView {
  verdict: CmpVerdict;
  title: string;
  desc: string;
  canonicalPath: string;
  jsonld: Array<Record<string, unknown>>;
  crumb: string;
  active: string;
  inlineScript: string;
  lede: string;
  aName: string;
  bName: string;
  aVendor: string;
  bVendor: string;
  rows: CompareRow[];
  summary: string[];
  /** 口径说明（hintLead + <a href="../../../cost/">成本计算器/cost calculator</a> + hintTrail） */
  hintLead: string;
  hintTrail: string;
  summaryDisclaimer: string;
  cta: { toCost: string; aProfile: string; bProfile: string };
  mixedCurrency: boolean;
}

export function buildCompareView(a: Model, b: Model, fx: FxFile, en: boolean): CompareView {
  const name = (m: Model) => (en ? enModelName(m) : m.name);
  const vendor = (m: Model) => (en ? enVendorLabel(m) : m.vendor);
  const curA = modelCurrency(a), curB = modelCurrency(b);
  const mixed = curA !== curB;
  const ca = monthly(a), cb = monthly(b); /* 各自官方币种原价 */
  const ba = toBase(ca, curA, fx), bb = toBase(cb, curB, fx); /* 统一折算 CNY；汇率未核实为 null */
  const fxOk = ba != null && bb != null;
  const v: CmpVerdict = fxOk ? verdict(ba!, bb!) : 'na'; /* 'a'|'b'|'tie'|'na'（无法统一折算时不标任何一方） */

  const cnyEst = (x: number, cur: string): string =>
    cur === 'CNY'
      ? money(x, 'CNY')
      : toBase(x, cur, fx) != null
        ? (en ? '≈ ' : '约 ') + money(toBase(x, cur, fx)!)
        : (en ? 'reference rate unverified; cannot convert' : '汇率未核实，无法折算');

  const peakText = (m: Model): { window: string } | null =>
    m.peakOffpeak
      ? { window: en ? EN_PEAK_WINDOW(m.peakOffpeak.peakWindow) : m.peakOffpeak.peakWindow }
      : null;

  const srcOf = (m: Model): { url: string | null; label: string } => ({
    url: safeUrl(m.sourceUrl),
    label: en ? enSrcLabel(m) : m.sourceName
  });

  const rows: CompareRow[] = [
    { label: en ? 'Vendor / channel' : '厂商 / 渠道', a: vendor(a), b: vendor(b) },
    { label: en ? 'Context window' : '上下文窗口', a: `${a.context}K`, b: `${b.context}K` },
    {
      label: en ? 'Modalities' : '支持模态',
      a: (a.modalities || []).map(x => (en ? EN_MODALITY[x] || x : x)).join(en ? ', ' : '、'),
      b: (b.modalities || []).map(x => (en ? EN_MODALITY[x] || x : x)).join(en ? ', ' : '、')
    },
    {
      label: en ? 'Features' : '特点',
      a: (a.features || []).map(x => (en ? EN_FEATURE[x] || x : x)).join(en ? ', ' : '、'),
      b: (b.features || []).map(x => (en ? EN_FEATURE[x] || x : x)).join(en ? ', ' : '、')
    },
    { label: en ? 'Input (cache miss)' : '输入价（未命中）', a: cellPriceText(a, 'in', en), b: cellPriceText(b, 'in', en) },
    { label: en ? 'Output' : '输出价', a: cellPriceText(a, 'out', en), b: cellPriceText(b, 'out', en) },
    { label: en ? 'Cache hit' : '缓存命中价', a: cellPriceText(a, 'cache', en), b: cellPriceText(b, 'cache', en) },
    {
      label: en ? 'Time-based pricing' : '分时段',
      a: '', b: '',
      aPeak: peakText(a),
      bPeak: peakText(b)
    },
    {
      label: en ? 'Est. monthly cost*' : '示例月成本*',
      a: money(ca, curA), b: money(cb, curB),
      cost: true,
      costTie: v === 'tie',
      aCny: mixed ? cnyEst(ca, curA) : null,
      bCny: mixed ? cnyEst(cb, curB) : null
    },
    { label: en ? 'Price source' : '数据来源', a: '', b: '', aSrc: srcOf(a), bSrc: srcOf(b) },
    { label: en ? 'Verified' : '核验日期', a: a.verifiedAt, b: b.verifiedAt }
  ];

  /* ---- 对比摘要：只写能从 models.json 数据直接推导、且口径明确的事实 ---- */
  const pa = lowPrices(a), pb = lowPrices(b);
  const summary: string[] = [];
  if (!fxOk) {
    summary.push(en
      ? `Estimated monthly cost: ${name(a)} ${money(ca, curA)} vs ${name(b)} ${money(cb, curB)} — the two are billed in different currencies and the reference rate is unverified, so they cannot be compared on one basis.`
      : `估算月成本：${a.name} ${money(ca, curA)} vs ${b.name} ${money(cb, curB)}——两者币种不同且参考汇率未核实，无法统一折算，不能直接比较成本。`);
  } else if (v === 'tie') {
    summary.push(en
      ? `Estimated monthly cost is tied: on a common CNY basis both come to about ${money(ba!)} (identical within display precision${mixed ? `, list prices ${money(ca, curA)} and ${money(cb, curB)}` : ''}).`
      : `估算月成本持平：统一折算后两者均约 ${money(ba!)}（展示精度 0.01 元内相同${mixed ? `，原价分别为 ${money(ca, curA)} 与 ${money(cb, curB)}` : ''}）。`);
    summary.push(en
      ? 'Cost ratio: equal under this basis; this conclusion holds only at the current list prices, reference rate and the fixed usage assumptions above.'
      : '成本比例：按该口径两者相同；该结论仅在当前刊例价、汇率与上述固定用量假设下成立。');
  } else {
    const cheaper = v === 'a' ? a : b;
    const dearer = v === 'a' ? b : a;
    const ct = v === 'a' ? ba! : bb!, dt = v === 'a' ? bb! : ba!; /* ct=便宜方成本, dt=贵方成本（CNY 折算口径） */
    summary.push(en
      ? `Estimated monthly cost: ${name(a)} ${money(ba!)} vs ${name(b)} ${money(bb!)} on a common CNY basis (list prices ${money(ca, curA)} / ${money(cb, curB)}) — at this fixed usage, ${name(cheaper)} is cheaper by ${fmtDiff(Math.abs(ba! - bb!))}/month.`
      : `估算月成本：统一折算后 ${a.name} ${money(ba!)} vs ${b.name} ${money(bb!)}（原价 ${money(ca, curA)} / ${money(cb, curB)}）——在该固定用量下 ${cheaper.name} 更低，相差 ${fmtDiff(Math.abs(ba! - bb!))}/月。`);
    summary.push(en
      ? `Cost ratio: under this basis, ${name(dearer)} costs about ${(dt / ct).toFixed(1)}× ${name(cheaper)} (${name(cheaper)} is ~${((1 - ct / dt) * 100).toFixed(0)}% cheaper). The ratio holds only at the current list prices, reference rate and fixed usage assumptions; it says nothing about capability, output quality or overall value.`
      : `成本比例：按该口径，${dearer.name} 的估算月成本约为 ${cheaper.name} 的 ${(dt / ct).toFixed(1)} 倍（${cheaper.name} 便宜约 ${((1 - ct / dt) * 100).toFixed(0)}%）。该比例只在当前刊例价、汇率与上述固定用量假设下成立，不代表模型能力、输出质量或综合性价比。`);
  }
  const unitRow = (label: string, x: number, y: number): string => {
    const bx = toBase(x, curA, fx), by = toBase(y, curB, fx);
    if (bx == null || by == null) {
      return en
        ? `${label}: ${name(a)} ${price(x, curA)} vs ${name(b)} ${price(y, curB)} (different currencies, reference rate unverified — no delta computed).`
        : `${label}：${a.name} ${price(x, curA)} vs ${b.name} ${price(y, curB)}（币种不同且汇率未核实，未做差额比较）。`;
    }
    if (Math.abs(bx - by) < 0.005) {
      return en
        ? `${label} tied after conversion: both ≈ ${money(bx)} (list prices ${price(x, curA)} / ${price(y, curB)}).`
        : `${label}折算后持平：均约 ${money(bx)}（原价 ${price(x, curA)} / ${price(y, curB)}）。`;
    }
    const lower = bx < by ? a : b;
    return en
      ? `${label}: list prices ${price(x, curA)} vs ${price(y, curB)}; after conversion ${name(lower)} is lower (by ≈ ${fmtDiff(bx - by)}/1M tokens).`
      : `${label}：原价 ${price(x, curA)} vs ${price(y, curB)}，折算后 ${lower.name} 更低（差约 ${fmtDiff(bx - by)}/百万Token）。`;
  };
  summary.push(unitRow(en ? 'Input unit price (off-peak / single-price basis)' : '输入单价（错峰低谷/单一价口径）', pa.i, pb.i));
  summary.push(unitRow(en ? 'Output unit price (off-peak / single-price basis)' : '输出单价（错峰低谷/单一价口径）', pa.o, pb.o));
  const cacheNote = (m: Model, c: number | null): string =>
    c == null
      ? (en ? `${name(m)} publishes no cache price (estimated at the standard input price)` : `${m.name} 未公开缓存价（估算时按未命中价计）`)
      : `${name(m)} ${price(c, modelCurrency(m))}`;
  summary.push(en
    ? `Cache-hit price (off-peak basis): ${cacheNote(a, pa.c)}; ${cacheNote(b, pb.c)}.`
    : `缓存命中价（低谷口径）：${cacheNote(a, pa.c)}；${cacheNote(b, pb.c)}。`);
  if (mixed) {
    summary.push(en
      ? `Currencies: ${name(a)} is billed in ${curA}, ${name(b)} in ${curB}; conversion uses the CFETS central parity rate (see above) and is indicative only.`
      : `币种说明：${a.name} 为 ${curA} 官方原价，${b.name} 为 ${curB} 官方原价；折算采用中国外汇交易中心中间价（见下），仅供参考。`);
  }
  if (a.context === b.context) {
    summary.push(en ? `Context window: identical at ${a.context}K.` : `上下文窗口相同：均为 ${a.context}K。`);
  } else {
    const bigger = a.context > b.context ? a : b;
    const smaller = a.context > b.context ? b : a;
    summary.push(en
      ? `Context window: ${name(a)} ${a.context}K vs ${name(b)} ${b.context}K — ${name(bigger)} is ${(bigger.context / smaller.context).toFixed(1)}× ${name(smaller)}.`
      : `上下文窗口：${a.name} ${a.context}K vs ${b.name} ${b.context}K，${bigger.name} 为 ${smaller.name} 的 ${(bigger.context / smaller.context).toFixed(1)} 倍。`);
  }
  const modA = (a.modalities || []).map(x => (en ? EN_MODALITY[x] || x : x));
  const modB = (b.modalities || []).map(x => (en ? EN_MODALITY[x] || x : x));
  const onlyA = (a.modalities || []).filter(x => !(b.modalities || []).includes(x));
  const onlyB = (b.modalities || []).filter(x => !(a.modalities || []).includes(x));
  if (!onlyA.length && !onlyB.length) {
    summary.push(en ? `Modalities: identical — ${modA.join(', ')}.` : `支持模态相同：${modA.join('、')}。`);
  } else {
    summary.push(en
      ? `Modalities: ${name(a)}=${modA.join(', ')}; ${name(b)}=${modB.join(', ')}${onlyA.length ? ` (${name(a)} adds ${onlyA.map(x => EN_MODALITY[x] || x).join(', ')})` : ''}${onlyB.length ? ` (${name(b)} adds ${onlyB.map(x => EN_MODALITY[x] || x).join(', ')})` : ''}.`
      : `支持模态：${a.name}=${modA.join('、')}；${b.name}=${modB.join('、')}${onlyA.length ? `（${a.name} 多出 ${onlyA.join('、')}）` : ''}${onlyB.length ? `（${b.name} 多出 ${onlyB.join('、')}）` : ''}。`);
  }
  summary.push(en
    ? `Price sources: ${enSrcLabel(a)} (verified ${a.verifiedAt}), ${enSrcLabel(b)} (verified ${b.verifiedAt}); unit: official list price per 1M tokens (${name(a)} in ${curA}, ${name(b)} in ${curB}${mixed ? '; cross-currency figures converted to CNY as noted above' : ''}).`
    : `数据来源：${a.sourceName}（核验 ${a.verifiedAt}）、${b.sourceName}（核验 ${b.verifiedAt}）；计价单位：官方原币种 / 百万 Token（${a.name} ${curA === 'USD' ? '美元' : '人民币'}、${b.name} ${curB === 'USD' ? '美元' : '人民币'}${mixed ? '；跨币种按上方参考汇率折算为人民币估算，仅供参考' : ''}）。`);

  return {
    verdict: v,
    title: en
      ? `${name(a)} vs ${name(b)} - Price, Context and Modality Comparison | ${BRAND}`
      : `${a.name} vs ${b.name} 对比 - 价格/上下文/模态 | ${BRAND}`,
    desc: en
      ? `${name(a)} (${vendor(a)}) vs ${name(b)} (${vendor(b)}): API prices, cache hit, time-based pricing, context window, modalities and a fixed-assumption monthly cost, line by line.`
      : `${a.name}（${a.vendor}）与 ${b.name}（${b.vendor}）API 逐项对比：输入输出价格、缓存命中、分时段、上下文窗口、模态与示例月成本。`,
    canonicalPath: `${en ? '/en' : ''}/compare/${a.id}/${b.id}/`,
    jsonld: [
      breadcrumb([
        { name: en ? 'Home' : '首页', path: en ? '/en/' : '/' },
        { name: en ? 'Model comparison' : '模型对比', path: en ? '/en/compare/' : '/compare/' },
        { name: `${name(a)} vs ${name(b)}`, path: `${en ? '/en' : ''}/compare/${a.id}/${b.id}/` }
      ])
    ],
    crumb: en
      ? `/ <a href="../../../compare/" style="color:inherit">Model comparison</a> / ${name(a)} vs ${name(b)}`
      : `/ <a href="../../" style="color:inherit">模型对比</a> / ${a.name} vs ${b.name}`,
    active: 'compare',
    inlineScript: `  <script>window.track('compare_view', { a: ${jsStr(a.id)}, b: ${jsStr(b.id)}${en ? ", lang: 'en'" : ''} });</script>`,
    lede: en
      ? `${name(a)} (${vendor(a)}) vs ${name(b)} (${vendor(b)}), side by side: input/output/cache-hit prices, time-based pricing, context window, modalities and a fixed-assumption monthly cost. Green marks the better row.`
      : `${a.name}（${a.vendor}）与 ${b.name}（${b.vendor}）的逐项对比：输入/输出/缓存命中价格、分时段、上下文窗口、支持模态与固定参数示例月成本。绿色为该项更优。`,
    aName: name(a),
    bName: name(b),
    aVendor: vendor(a),
    bVendor: vendor(b),
    rows,
    summary,
    hintLead: en
      ? '* Fixed assumptions for the example monthly cost: 100 calls/day · 2,000 input / 800 output tokens per call · off-peak rates · 30% cache hit rate · 30-day month — the same formula and defaults as the '
      : '* 示例月成本固定参数：日均 100 次调用 · 单次输入 2000 / 输出 800 Token · 错峰（低谷价）· 缓存命中率 30%，公式与默认值同 ',
    hintTrail: en
      ? '. USD models are converted to CNY at the reference rate for comparison (see summary). Costs within display precision are marked tied; neither side is favored.'
      : ' 一致。美元模型按参考汇率统一折算为人民币后比较（折算见摘要）。两者成本在展示精度内相同时标记持平，不突出任何一方。',
    summaryDisclaimer: en
      ? 'These are computations from published list prices under fixed call volume, token usage, cache assumptions and billing rules. They are not rankings of capability, output quality or overall value, and do not constitute purchase advice.'
      : '以上仅为公开价目在指定调用量、输入输出 Token 数、缓存假设与计费规则下的计算结果与数据对比，不代表模型能力、输出质量或综合性价比排名，不构成采购建议。',
    cta: {
      toCost: en ? 'Calculate with your own usage →' : '按你的用量精确算 →',
      aProfile: en ? `${name(a)} profile` : `${a.name} 档案`,
      bProfile: en ? `${name(b)} profile` : `${b.name} 档案`
    },
    mixedCurrency: mixed
  };
}

export { TIE_EPS };
