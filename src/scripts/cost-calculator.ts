/**
 * 成本计算器交互（中英双端共用模块，按 <html lang> 切换文案与存储键）：
 * 公式唯一实现源 = window.CostCore（assets/cost-core.js，与 pricing.mjs 对拍一致）；
 * 状态持久化 localStorage、?models= 深链预勾选、复制结果分享、埋点节流——与迁移前两份内联脚本逐字一致。
 * 英文端的展示字典直接 import i18n 字典模块（单一翻译来源），不再依赖 labels-en.js。
 */
import { EN_VENDOR, EN_MODALITY, EN_FEATURE, EN_TIER_DESC } from '../lib/i18n/dictionaries.mjs';

declare global {
  interface Window {
    ASSETS_BASE: string;
    track?: (event: string, params?: Record<string, unknown>) => void;
    CostCore: {
      tierPrice: (m: CalcModel, inTok: number) => { desc?: string } | null;
      effectiveInputPrice: (m: CalcModel, opts: { offpeak: boolean; inTok: number }, hitRatio: number) => { effIn: number; out: number } | null;
      monthlyCost: (pr: { effIn: number; out: number }, calls: number, inTok: number, outTok: number) => { total: number; inCost: number; outCost: number };
    };
  }
}

interface CalcModel {
  id: string;
  name: string;
  vendor: string;
  currency?: string;
  priceIn: number;
  priceOut: number;
  priceCacheHit?: number | null;
  priceTiers?: Array<{ desc: string; priceIn?: number; priceOut?: number; unverified?: boolean }>;
  peakOffpeak?: { peakIn: number; offIn: number; peakOut: number; offOut: number } | null;
  modalities?: string[];
  features?: string[];
}

const en = document.documentElement.lang === 'en';
const LOCALE = en ? 'en-US' : 'zh-CN';
const T = (zh: string, e: string): string => (en ? e : zh);
const DEFAULT_SELECTED = ['deepseek-v41-flash', 'glm-53-flash', 'qwen35-plus', 'kimi-k3'];
const STORE_KEY = en ? 'rh_cost_state_en_v1' : 'aih_cost_state_v1';

const state = {
  selected: DEFAULT_SELECTED.slice(),
  calls: 100,
  inTok: 2000,
  outTok: 800,
  offpeak: true,
  cacheHit: 30
};

let models: CalcModel[] = [];
const FX = { usdCny: null as number | null, rateDate: null as string | null }; /* 参考汇率：未核实不参与折算 */
function fxReady(): boolean { return typeof FX.usdCny === 'number' && FX.usdCny > 0 && !!FX.rateDate; }
function sym(m: CalcModel): string { return m.currency === 'USD' ? '$' : '¥'; }
function fmtCur(n: number, m: CalcModel): string { return sym(m) + n.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function toCny(m: CalcModel, v: number): number | null { return m.currency === 'USD' ? (fxReady() ? v * FX.usdCny! : null) : v; }
function fmtCny(v: number): string { return '¥' + v.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtConv(m: CalcModel, v: number): string {
  const c = toCny(m, v);
  if (c == null) return T('参考汇率未核实，无法折算', 'Reference rate unverified; conversion unavailable');
  return m.currency === 'USD'
    ? T('约 ', '≈ ') + fmtCny(c) + T(`（按 ${FX.rateDate} 中间价折算，仅供参考）`, ` (converted at the ${FX.rateDate} central parity rate, indicative only)`)
    : fmtCny(c);
}

/* ---------- 英文展示字典（与 i18n 字典模块同源，单一翻译来源） ---------- */
const enVendor = (m: CalcModel): string => (en ? EN_VENDOR[m.vendor] || m.vendor : m.vendor);
const enDict = (s: string, dict: Record<string, string>): string => (en ? dict[s] || s : s);
function enTierDesc(s: string): string {
  if (!en) return s;
  for (const pair of EN_TIER_DESC as string[][]) s = s.split(pair[0]).join(pair[1]);
  return s;
}

/* ---------- 状态持久化 ---------- */
function saveState(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* 静默 */ }
}
function loadState(): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && typeof s === 'object') {
      if (Array.isArray(s.selected)) state.selected = s.selected;
      ['calls', 'inTok', 'outTok', 'cacheHit'].forEach(k => {
        if (typeof s[k] === 'number' && isFinite(s[k]) && s[k] >= 0) (state as Record<string, unknown>)[k] = s[k];
      });
      if (typeof s.offpeak === 'boolean') state.offpeak = s.offpeak;
    }
  } catch { /* 静默 */ }
}
/* ?models=id1,id2 深链预勾选（优先级高于本地存储） */
function applyQueryModels(): void {
  const m = /[?&]models=([a-z0-9,\-]+)/i.exec(location.search);
  if (!m) return;
  const ids = m[1].split(',').filter(Boolean);
  if (ids.length) state.selected = ids;
}

/* ---------- 计算：委托共享核心 CostCore（公式与英文版及 pricing.mjs 完全一致） ---------- */
function tierPrice(m: CalcModel, inTok: number): { desc?: string } | null { return window.CostCore.tierPrice(m, inTok); }
function effectiveInputPrice(m: CalcModel, hitRatio: number): { effIn: number; out: number } | null {
  return window.CostCore.effectiveInputPrice(m, { offpeak: state.offpeak, inTok: state.inTok }, hitRatio);
}
function monthlyCost(m: CalcModel): { total: number; inCost: number; outCost: number } | null {
  const pr = effectiveInputPrice(m, state.cacheHit / 100);
  if (!pr) return null;
  return window.CostCore.monthlyCost(pr, state.calls, state.inTok, state.outTok);
}
function fmtMult(n: number): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/* ---------- 渲染 ---------- */
const modelEls: Record<string, { label: HTMLElement; input: HTMLInputElement }> = {};
let collapsed = true;

function tagsHtml(m: CalcModel): string {
  let t = '';
  (m.modalities || []).forEach(x => { t += '<span class="tag tag-mod">' + enDict(x, EN_MODALITY) + '</span>'; });
  (m.features || []).forEach(x => { t += '<span class="tag tag-feat">' + enDict(x, EN_FEATURE) + '</span>'; });
  return t ? '<span class="m-tags">' + t + '</span>' : '';
}
function setSelected(id: string, on: boolean): void {
  const idx = state.selected.indexOf(id);
  if (on && idx < 0) state.selected.push(id);
  if (!on && idx >= 0) state.selected.splice(idx, 1);
  const el = modelEls[id];
  if (el) {
    el.input.checked = on;
    el.label.classList.toggle('checked', on);
  }
  renderChips();
  onChange();
}
function renderChips(): void {
  const box = document.getElementById('selChips');
  if (!box) return;
  box.innerHTML = '';
  state.selected.forEach(id => {
    const m = models.find(x => x.id === id);
    if (!m) return;
    const chip = document.createElement('span');
    chip.className = 'sel-chip';
    chip.innerHTML = m.name + '<button type="button" aria-label="' + T('移除 ', 'Remove ') + m.name + '">×</button>';
    chip.querySelector('button')!.addEventListener('click', () => setSelected(id, false));
    box.appendChild(chip);
  });
  box.style.visibility = state.selected.length ? 'visible' : 'hidden';
}
function toggleGrid(): void {
  collapsed = !collapsed;
  document.getElementById('modelGrid')!.classList.toggle('collapsed', collapsed);
  document.getElementById('btnToggleModels')!.textContent =
    collapsed ? T('展开全部 ', 'Show all ') + models.length + T(' 款 ▾', ' models ▾') : T('收起 ▴', 'Hide ▴');
}
function renderModelGrid(): void {
  const grid = document.getElementById('modelGrid');
  if (!grid) return;
  grid.innerHTML = '';
  models.forEach(m => {
    const label = document.createElement('label');
    label.className = 'model-card' + (state.selected.indexOf(m.id) >= 0 ? ' checked' : '');
    const s = sym(m);
    const priceText = m.priceTiers
      ? m.priceTiers.map(t => enTierDesc(t.desc) + (t.unverified ? T(' 费率未公开', ' rate not published') : T(` 入${s}${t.priceIn}/出${s}${t.priceOut}`, ` In ${s}${t.priceIn} / Out ${s}${t.priceOut}`))).join('<br>')
      : m.peakOffpeak
        ? T(`高峰 入${s}${m.peakOffpeak.peakIn}/出${s}${m.peakOffpeak.peakOut}<br>低谷 入${s}${m.peakOffpeak.offIn}/出${s}${m.peakOffpeak.offOut}`,
            `Peak In ${s}${m.peakOffpeak.peakIn} / Out ${s}${m.peakOffpeak.peakOut}<br>Off-peak In ${s}${m.peakOffpeak.offIn} / Out ${s}${m.peakOffpeak.offOut}`)
        : T(`输入 ${s}${m.priceIn}<br>输出 ${s}${m.priceOut}`, `Input ${s}${m.priceIn}<br>Output ${s}${m.priceOut}`);
    label.innerHTML =
      '<input type="checkbox" value="' + m.id + '"' + (state.selected.indexOf(m.id) >= 0 ? ' checked' : '') + '>' +
      '<span class="m-info">' +
        '<span class="m-name">' + m.name + (m.peakOffpeak ? `<span class="tag-peak">${T('分时段', 'Time-based')}</span>` : '') + '</span><br>' +
        '<span class="m-vendor">' + enVendor(m) + '</span>' + tagsHtml(m) +
      '</span>' +
      '<span class="m-price num">' + priceText + '</span>';
    label.querySelector('input')!.addEventListener('change', e => {
      setSelected((e.target as HTMLInputElement).value, (e.target as HTMLInputElement).checked);
    });
    modelEls[m.id] = { label, input: label.querySelector('input')! };
    grid.appendChild(label);
  });
  const btn = document.getElementById('btnToggleModels');
  if (btn) {
    btn.textContent = T('展开全部 ', 'Show all ') + models.length + T(' 款 ▾', ' models ▾');
    btn.addEventListener('click', toggleGrid);
  }
}

interface ResultRow {
  model: CalcModel;
  total: number | null;
  inCost: number | null;
  outCost: number | null;
  cny: number | null;
}

function renderResults(): void {
  const area = document.getElementById('resultArea');
  const ss = document.getElementById('stickySummary');
  if (!area || !ss) return;
  const picked = models.filter(m => state.selected.indexOf(m.id) >= 0);
  if (!picked.length) {
    area.innerHTML = `<p class="empty-hint">${T('请至少选择一款模型', 'Select at least one model to compare costs')}</p>`;
    ss.classList.remove('show');
    return;
  }
  const rows: ResultRow[] = picked.map(m => {
    const c = monthlyCost(m);
    return { model: m, total: c ? c.total : null, inCost: c ? c.inCost : null, outCost: c ? c.outCost : null, cny: c ? toCny(m, c.total) : null };
  }).sort((a, b) => {
    if (a.cny == null && b.cny == null) return 0;
    if (a.cny == null) return 1;
    if (b.cny == null) return -1;
    return a.cny - b.cny;
  });

  const okRows = rows.filter(r => r.cny != null);
  const min = okRows.length ? okRows[0].cny! : null, max = okRows.length ? okRows[okRows.length - 1].cny! : null;
  const EPS = 0.005; /* 展示精度（0.01 元）内视为持平，不突出任何一方 */
  const allTie = okRows.length > 1 && max! - min! < EPS;
  const minCount = okRows.filter(r => r.cny! - min! < EPS).length;
  let html = !okRows.length
    ? `<div class="summary">${T('所选模型的估算成本均无法折算（参考汇率未核实或档位费率未公开）', 'Costs for the selected models cannot be converted (reference rate unverified or tier rate not published)')}</div>`
    : allTie
      ? `<div class="summary">${T('所选 ', 'The ')}${okRows.length}${T(' 款模型在该用量下的估算月成本持平（展示精度内相同，均为 <span class="num">', ' selected models are tied at this usage (identical within display precision, all <span class="num">')}${fmtCny(min!)}${T('/月</span>）', '/month</span>')}</div>`
      : `<div class="summary">${T('最省的是 <b>', 'Cheapest: <b>')}${okRows[0].model.name}${T('</b>（<span class="num">', '</b> (<span class="num">')}${fmtCny(min!)}${T('/月</span>）', '/month</span>)')}` +
        T('，最贵的是 <b>', ' · priciest: <b>') + okRows[okRows.length - 1].model.name + T('</b>（<span class="num">', '</b> (<span class="num">') + fmtCny(max!) + T('/月</span>）', '/month</span>)') +
        T('，相差 <span class="num">', ' · <span class="num">') + fmtMult(max! / min!) + T('</span> 倍（统一按人民币折算口径）', '</span>× apart (all converted to CNY for comparison)') + `</div>`;

  rows.forEach(r => {
    const best = !allTie && r.cny != null && r.cny! - min! < EPS;
    const tier = tierPrice(r.model, state.inTok);
    const tierNote = tier && tier.desc ? (en ? ' (tier: ' + enTierDesc(tier.desc) + ')' : '（' + tier.desc + ' 档费率）') : '';
    const costMain = r.total == null
      ? T('该档位费率未公开，无法估算', 'Tier rate not published; cannot estimate')
      : fmtCur(r.total, r.model) + '<span style="font-size:13px;font-weight:400;color:var(--muted)">' + T('/月', '/month') + '</span>';
    html += '<div class="result-card' + (best ? ' best' : '') + '">' +
      '<div class="r-head">' +
        '<span class="r-name"><a class="r-name-link" href="../models/' + r.model.id + '/" title="' + T('查看 ', 'View ') + r.model.name + T(' 档案', ' profile') + '">' + r.model.name + '</a>' +
          '<span class="r-vendor">' + enVendor(r.model) + '</span>' +
          (best ? '<span class="badge-best">' + (minCount > 1 ? T('并列最低', 'Tied for lowest') : T('该用量下成本最低', 'Lowest cost for this usage')) + '</span>' : '') +
          tagsHtml(r.model) +
        '</span>' +
        '<span class="r-cost num">' + costMain + '</span>' +
      '</div>' +
      '<div class="r-detail">' +
        (r.total == null
          ? (en ? '<span>The vendor has not published a rate for this input-length tier; lower tiers are not substituted</span>' : '<span>官方未公布该输入长度档位费率，不套用低档价格</span>')
          : '<span>' + T('输入成本 ', 'Input cost ') + '<span class="num">' + fmtCur(r.inCost!, r.model) + '</span></span>' +
            '<span>' + T('输出成本 ', 'Output cost ') + '<span class="num">' + fmtCur(r.outCost!, r.model) + '</span></span>') +
        (r.cny != null && r.model.currency === 'USD' ? '<span class="r-mult">' + fmtConv(r.model, r.total!) + '</span>' : '') +
        (r.cny != null ? '<span class="r-mult">' + (best ? (minCount > 1 ? T('并列最便宜', 'Tied cheapest') : T('最便宜', 'Cheapest')) : T('为最低价的 <span class="num">', '<span class="num">') + fmtMult(r.cny / min!) + T('</span> 倍', '</span>× the lowest')) + tierNote + '</span>' : '') +
      '</div>' +
    '</div>';
  });

  html += `<p class="methodology">${T('方法论：低谷跑批 + 稳定前缀（提升缓存命中）是两类确定性降本手段；美元模型按参考汇率折算参与比价，折算值仅供参考。', 'Methodology: batching off-peak and keeping a stable prompt prefix (to raise cache hits) are two deterministic ways to cut cost; USD models are converted at a reference rate for comparison only.')}</p>`;
  html += `<p class="disclaimer">${T('实际费用以厂商账单为准，本结果仅供预算参考。', 'Actual charges follow the vendor\'s invoice. This result is for budgeting only.')}</p>`;
  html += `<div class="quiz-actions" style="margin-top:14px"><button type="button" class="btn btn-ghost" id="btnShareCalc">${T('复制结果，分享给朋友', 'Copy result to share')}</button></div>`;
  area.innerHTML = html;

  const shareBtn = document.getElementById('btnShareCalc');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => { shareResults(rows, min, max); });
  }

  ss.innerHTML = okRows.length
    ? `<span>${T('最省 <b>', 'Cheapest <b>')}${okRows[0].model.name}${T('</b> <span class="ss-num num">', '</b> <span class="ss-num num">')}${fmtCny(min!)}${T('/月</span></span><span class="ss-go">查看明细 ↓</span>', '/month</span></span><span class="ss-go">View details ↓</span>')}`
    : `<span>${T('所选模型暂无法折算估算', 'Selected models cannot be estimated yet')}</span>`;
  ss.classList.add('show');
}

/* ---------- 结果复制分享 ---------- */
function showToast(text: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  const el = t as HTMLElement & { _timer?: ReturnType<typeof setTimeout> };
  clearTimeout(el._timer);
  el._timer = setTimeout(() => t.classList.remove('show'), 1600);
}
function copyText(text: string, done: () => void): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
  } else {
    legacyCopy(text, done);
  }
}
function legacyCopy(text: string, done: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch { showToast(T('复制失败，请手动选择文本', 'Copy failed, please select the text manually')); }
  document.body.removeChild(ta);
}
function shareResults(rows: ResultRow[], min: number | null, max: number | null): void {
  const okRows = rows.filter(r => r.cny != null);
  const EPS = 0.005;
  const allTie = max! - min! < EPS;
  const lines = [T('【AI大模型 API 月成本估算】', '[LLM API Monthly Cost Estimate]')];
  lines.push(T('用量：日均 ', 'Usage: ') + state.calls + T(' 次调用 · 单次输入 ', ' calls/day · ') + state.inTok + T(' / 输出 ', ' in / ') + state.outTok + T(' Token · ', ' out tokens per call · ') + T('错峰', '') + (state.offpeak ? T('（低谷价）', 'off-peak rates') : T('（高峰价）', 'peak rates')) + T(' · 缓存命中率 ', ' · cache hit ') + state.cacheHit + '%');
  rows.forEach((r, i) => {
    if (r.total == null) { lines.push((i + 1) + '. ' + r.model.name + T('：档位费率未公开，无法估算', ': tier rate not published, cannot estimate')); return; }
    lines.push((i + 1) + '. ' + r.model.name + ' ' + fmtCur(r.total, r.model) + T('/月', '/month') + (r.model.currency === 'USD' ? '（' + fmtConv(r.model, r.total) + '）' : '') + (!allTie && r.cny != null && r.cny! - min! < EPS ? T(' ← 该用量下成本最低', ' ← lowest for this usage') : ''));
  });
  if (!okRows.length) {
    lines.push(T('所选模型均无法折算估算。', 'None of the selected models can be estimated.'));
  } else if (allTie) {
    lines.push(T('所选模型在该用量下估算月成本持平（', 'All selected models are tied at this usage (') + fmtCny(min!) + T('/月）。', '/month).'));
  } else {
    lines.push(T('最省的是 ', 'Cheapest: ') + okRows[0].model.name + T('，最贵的是 ', ' · priciest: ') + okRows[okRows.length - 1].model.name + T('，相差 ', ' · ') + fmtMult(max! / min!) + T(' 倍（人民币折算口径）。', '× apart (CNY-converted basis).'));
  }
  lines.push(T('测算：Reflex Hub reflex-hub.com/cost/（免费免注册）', 'Estimate: Reflex Hub reflex-hub.com/en/cost/ (free, no sign-up)'));
  copyText(lines.join('\n'), () => {
    showToast(T('已复制，去粘贴分享吧', 'Copied — paste it anywhere to share'));
    window.track && window.track('cost_share', { models: state.selected.slice() });
  });
}

/* ---------- 变更与埋点 ---------- */
let trackTimer: ReturnType<typeof setTimeout> | null = null;
function onChange(): void {
  saveState();
  renderResults();
  if (trackTimer) clearTimeout(trackTimer);
  trackTimer = setTimeout(() => {
    window.track && window.track('cost_calculate', {
      models: state.selected.slice(),
      peakOff: state.offpeak,
      cacheHit: state.cacheHit
    });
  }, 1000);
}

function bindInputs(): void {
  const calls = document.getElementById('inCalls') as HTMLInputElement | null;
  const inTok = document.getElementById('inTokens') as HTMLInputElement | null;
  const outTok = document.getElementById('outTokens') as HTMLInputElement | null;
  const sw = document.getElementById('swOffpeak') as HTMLInputElement | null;
  const rg = document.getElementById('rgCache') as HTMLInputElement | null;
  const cacheVal = document.getElementById('cacheVal');
  if (!calls || !inTok || !outTok || !sw || !rg || !cacheVal) return;

  calls.value = String(state.calls);
  inTok.value = String(state.inTok);
  outTok.value = String(state.outTok);
  sw.checked = state.offpeak;
  rg.value = String(state.cacheHit);
  cacheVal.textContent = state.cacheHit + '%';

  function num(input: HTMLInputElement, key: string): void {
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      (state as Record<string, unknown>)[key] = isFinite(v) && v >= 0 ? v : 0;
      onChange();
    });
  }
  num(calls, 'calls');
  num(inTok, 'inTok');
  num(outTok, 'outTok');
  sw.addEventListener('change', () => { state.offpeak = sw.checked; onChange(); });
  rg.addEventListener('input', () => {
    state.cacheHit = parseInt(rg.value, 10) || 0;
    cacheVal.textContent = state.cacheHit + '%';
    onChange();
  });
}

/* ---------- 启动 ---------- */
function boot(): void {
  loadState();
  Promise.all([
    fetch(window.ASSETS_BASE + '/data/models.json').then(res => res.json()),
    fetch(window.ASSETS_BASE + '/data/fx.json').then(res => res.json()).catch(() => null)
  ]).then(res => {
    models = res[0];
    const fx = res[1];
    if (fx && fx.rates && fx.rates.USD_CNY && typeof fx.rates.USD_CNY.rate === 'number' && fx.rates.USD_CNY.rate > 0 && fx.rates.USD_CNY.rateDate) {
      FX.usdCny = fx.rates.USD_CNY.rate;
      FX.rateDate = fx.rates.USD_CNY.rateDate;
    }
    applyQueryModels();
    state.selected = state.selected.filter(id => models.some(m => m.id === id));
    renderModelGrid();
    renderChips();
    bindInputs();
    const ss = document.getElementById('stickySummary');
    ss && ss.addEventListener('click', () => {
      document.getElementById('resultArea')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    renderResults();
  }).catch(() => {
    const area = document.getElementById('resultArea');
    if (area) area.innerHTML = `<p class="empty-hint">${T('价格数据加载失败，请刷新重试', 'Failed to load price data — please refresh')}</p>`;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
