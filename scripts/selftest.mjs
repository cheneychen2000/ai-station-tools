/** 公式 / 数据完整性 / 题库 / QR 往返自检：全部强制断言，任一失败退出码非零 */
import { readFileSync } from 'node:fs';
import { DIST } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { monthlyFull, monthly, money, tierFor, toBase, fxEntry, monthlyBase } from './lib/pricing.mjs';
import { join } from 'node:path';

const R = createReporter('selftest');
const models = JSON.parse(readFileSync(join(DIST, 'assets/data/models.json'), 'utf8'));

const eff = (m, off, hit) => {
  const b = m.peakOffpeak
    ? (off ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
      : { i: m.peakOffpeak.peakIn, c: m.peakOffpeak.peakCache, o: m.peakOffpeak.peakOut })
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut };
  return { ei: b.c == null ? b.i : hit * b.c + (1 - hit) * b.i, o: b.o };
};

/* T5 手工验算（日均10000/输入2000/输出800/错峰/命中30%）：输出值并断言分项与总额自洽 */
const ds = models.find(m => m.id === 'deepseek-v41-flash') || models.find(m => m.peakOffpeak);
const r5 = monthlyFull(ds, { off: true, hit: 0.3, calls: 10000, inTok: 2000, outTok: 800 });
R.check(`T5 ${ds.id} 月成本 = ${r5.t.toFixed(2)}（输入 ${r5.ic.toFixed(2)} + 输出 ${r5.oc.toFixed(2)}）`,
  Math.abs(r5.ic + r5.oc - r5.t) < 1e-9 && r5.t > 0, '分项之和=总额');

/* T1 错峰开关 2 倍关系（分时段模型：低谷价=高峰价一半） */
for (const m of models.filter(m => m.peakOffpeak)) {
  const peak = monthlyFull(m, { off: false, hit: 0.5, calls: 5000, inTok: 1500, outTok: 500 });
  const off = monthlyFull(m, { off: true, hit: 0.5, calls: 5000, inTok: 1500, outTok: 500 });
  R.check(`T1 ${m.id} 高峰/低谷 = 2`, Math.abs(peak.t / off.t - 2) < 1e-9, `实际 ${(peak.t / off.t).toFixed(6)}`);
}

/* T2 命中率 0% 时输入价 = 未命中价 */
for (const m of models) {
  const p0 = eff(m, true, 0);
  const base = m.peakOffpeak ? m.peakOffpeak.offIn : m.priceIn;
  R.check(`T2 ${m.id} hit=0 effIn === 未命中价`, p0.ei === base);
}

/* T3 数据完整性：日期格式合法、context 为正数（不写死具体核验日期） */
R.check('T3 模型数 ≥10 且 verifiedAt 均为合法 YYYY-MM-DD',
  models.length >= 10 && models.every(m => /^\d{4}-\d{2}-\d{2}$/.test(m.verifiedAt) && !isNaN(Date.parse(m.verifiedAt))));
R.check('T3c context 全部为正数', models.every(m => typeof m.context === 'number' && m.context > 0));

/* T4 模态/特点字段完整性 */
const MOD_SET = ['文本', '图像理解', '音频', '视频理解'];
R.check('T4 modalities/features 字段全部合法', models.every(m =>
  Array.isArray(m.modalities) && m.modalities.length > 0 && m.modalities.every(x => MOD_SET.includes(x)) &&
  Array.isArray(m.features) && m.features.length > 0 && m.features.length <= 3 && m.features.every(x => x.length <= 6)
));

/* T7 quiz.json 校验（V1 schema：dim/hard/q/options/answer/explain，二元对错） */
const quiz = JSON.parse(readFileSync(join(DIST, 'assets/data/quiz.json'), 'utf8'));
const DIM_KEYS = ['concept', 'price', 'boundary', 'industry', 'practice', 'safety'];
const dimCount = Object.fromEntries(DIM_KEYS.map(k => [k, 0]));
quiz.forEach(q => { if (q.dim in dimCount) dimCount[q.dim]++; });
R.check('T7 quiz.json 12 题且六维各 2 题', quiz.length === 12 && DIM_KEYS.every(k => dimCount[k] === 2));
R.check('T7s schema(dim/hard/options 去重/answer/explain) 合法', quiz.every(q =>
  DIM_KEYS.includes(q.dim) && typeof q.hard === 'boolean' &&
  typeof q.q === 'string' && q.q.length > 5 &&
  Array.isArray(q.options) && (q.options.length === 2 || q.options.length === 4) &&
  q.options.every(o => typeof o === 'string' && o.length > 0) &&
  new Set(q.options).size === q.options.length &&
  Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length &&
  typeof q.explain === 'string' && q.explain.length > 10));
R.check('T7c 每维 1 送分 + 1 硬核', DIM_KEYS.every(k =>
  quiz.filter(q => q.dim === k && q.hard).length === 1 && quiz.filter(q => q.dim === k && !q.hard).length === 1));
const posCount = [0, 0, 0, 0];
quiz.filter(q => q.options.length === 4).forEach(q => posCount[q.answer]++);
R.check(`T7b 正确项位置分布 ${JSON.stringify(posCount)}：覆盖 ≥3 位且同位 ≤5`,
  posCount.filter(c => c > 0).length >= 3 && Math.max(...posCount) <= 5);
R.check('T7d 判断题选项统一真在前', quiz.filter(q => q.options.length === 2).every(q => q.options[0].startsWith('真')));

/* T8 段位边界（V1 九段制，按答对题数 0~12） */
const tierName = s => s >= 12 ? '职业九段' : s >= 11 ? '职业三段' : s >= 10 ? '职业初段' :
  s >= 9 ? '业余五段' : s >= 8 ? '业余四段' : s >= 6 ? '业余三段' :
  s >= 4 ? '业余二段' : s >= 2 ? '业余初段' : '门外汉';
const bounds = [[0, '门外汉'], [1, '门外汉'], [2, '业余初段'], [3, '业余初段'], [4, '业余二段'], [5, '业余二段'],
  [6, '业余三段'], [7, '业余三段'], [8, '业余四段'], [9, '业余五段'], [10, '职业初段'], [11, '职业三段'], [12, '职业九段']];
R.check('T8 九段制边界全部正确', bounds.every(([s, t]) => tierName(s) === t));

/* T9 QR 生成器结构校验 */
await import('../dist/assets/qr.js');
const qr = globalThis.QRMini.encode('https://www.reflex-hub.com/quiz/?utm_source=poster');
const qrChecks = [
  ['size=33', qr.size === 33],
  ['finder 左上外角', qr.get(0, 0) === true],
  ['finder 左上内白环', qr.get(1, 1) === false],
  ['finder 中心', qr.get(3, 3) === true],
  ['finder 右上', qr.get(32, 0) === true],
  ['finder 左下', qr.get(0, 32) === true],
  ['timing 偶数位深', qr.get(6, 8) === true],
  ['timing 奇数位浅', qr.get(6, 9) === false],
  ['对齐图案中心(26,26)', qr.get(26, 26) === true],
  ['格式位 bit0(M+mask0)', qr.get(8, 0) === false],
  ['格式位 bit1', qr.get(8, 1) === true],
  ['格式位 bit4', qr.get(8, 4) === true],
  ['暗模块', qr.get(8, 25) === true],
];
R.check('T9 QR 结构校验全部通过', qrChecks.every(([, ok]) => ok),
  qrChecks.filter(([, ok]) => !ok).map(([n]) => n).join(', ') || '13 项结构断言');
const qr2 = globalThis.QRMini.encode('https://www.reflex-hub.com/quiz/?utm_source=poster');
let same = true;
for (let y = 0; y < 33 && same; y++) for (let x = 0; x < 33 && same; x++) if (qr.get(x, y) !== qr2.get(x, y)) same = false;
R.check('T9b QR 生成确定性', same);

/* T11 长 URL（约 50 字符级）QRMini 可编码（QR 编码器容量回归，与品牌渠道无关） */
const MP_QR_URL = 'https://weixin.qq.com/r/mp/xxxnf6DEYv0dreQc90nV';
let t11 = false;
try {
  const mq = globalThis.QRMini.encode(MP_QR_URL);
  t11 = mq.size === 33 && mq.get(0, 0) === true && mq.get(3, 3) === true;
} catch (e) { t11 = false; }
R.check(`T11 长 URL(${MP_QR_URL.length} 字符) QRMini 可编码`, t11);

/* T10 QR 往返自检：从矩阵反向提取码字 → 逐块验证 ECC + 格式位常量 */
(function qrRoundTrip() {
  const Q = globalThis.QRMini;
  const S = 33, NB = 2, PER = 32, ECC = 18;
  const bytes = [];
  let cur = 0, n = 0;
  for (let right = S - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < S; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? S - 1 - vert : vert;
        if (!qr.isFunction(x, y)) {
          let bit = qr.get(x, y) ? 1 : 0;
          if ((x + y) % 2 === 0) bit ^= 1;
          cur = (cur << 1) | bit; n++;
          if (n === 8) { bytes.push(cur); cur = 0; n = 0; }
        }
      }
    }
  }
  if (!R.check('T10 码字数 = 100', bytes.length === 100, `实际 ${bytes.length}`)) return;
  const blocks = Array.from({ length: NB }, () => ({ d: [], e: [] }));
  let p = 0;
  for (let t = 0; t < PER; t++) for (let b = 0; b < NB; b++) blocks[b].d.push(bytes[p++]);
  for (let t = 0; t < ECC; t++) for (let b = 0; b < NB; b++) blocks[b].e.push(bytes[p++]);
  const div = Q._rsDivisor(ECC);
  R.check('T10a ECC 逐块校验', blocks.every(bk => Q._rsRemainder(bk.d, div).every((v, i) => v === bk.e[i])));
  let fmt = 0;
  const setBit = i => { fmt |= 1 << i; };
  for (let i = 0; i <= 5; i++) if (qr.get(8, i)) setBit(i);
  if (qr.get(8, 7)) setBit(6);
  if (qr.get(8, 8)) setBit(7);
  if (qr.get(7, 8)) setBit(8);
  for (let i = 9; i < 15; i++) if (qr.get(14 - i, 8)) setBit(i);
  R.check('T10b 格式位 === 0x5412（ECC M + mask 0）', fmt === 0x5412);
  const stream = blocks[0].d.concat(blocks[1].d);
  const allBits = [];
  stream.forEach(bv => { for (let i = 7; i >= 0; i--) allBits.push((bv >>> i) & 1); });
  const url = 'https://www.reflex-hub.com/quiz/?utm_source=poster';
  const headOk = (stream[0] >>> 4) === 4 && (((stream[0] & 0xF) << 4) | (stream[1] >>> 4)) === url.length;
  let payloadOk = true;
  for (let i = 0; i < url.length; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | allBits[12 + i * 8 + j];
    if (v !== url.charCodeAt(i)) { payloadOk = false; break; }
  }
  R.check(`T10c 数据头（模式+长度${url.length}）与 URL 载荷逐字节一致`, headOk && payloadOk);
})();

/* T12 条件价档：按输入长度选档正确；12 款默认用量月成本快照（防价档改造引入非预期变化） */
const mm = models.find(m => m.id === 'minimax-m3');
R.check('T12 MiniMax M3 价档选择正确（≤512K 低档 / >512K 高档 / 边界 524288）',
  mm && mm.priceTiers.length === 2 &&
  tierFor(mm, 2000).priceIn === 2.1 && tierFor(mm, 524288).priceIn === 2.1 && tierFor(mm, 524289).priceIn === 4.2 &&
  tierFor(mm, 600000).priceOut === 16.8);
R.check('T12b 无价档模型 tierFor 返回 null（回退顶层价格）',
  models.filter(m => !m.priceTiers).every(m => tierFor(m, 100) === null));
const SNAP = {
  'deepseek-v41-flash': '¥13.84', 'deepseek-v4-pro': '¥51.57', 'glm-53': '¥104.40', 'glm-53-flash': '¥10.49',
  'kimi-k3': '¥327.60', 'qwen35-plus': '¥16.32', 'qwen37-plus': '¥31.20', 'qwen38-flash': '¥10.02',
  'hunyuan-turbos-vision': '¥39.60', 'minimax-m3': '¥32.76', 'mimo-v25-pro': '¥92.40', 'step-37-flash': '¥25.60'
};
R.check('T12c 12 款人民币模型默认用量月成本快照不变（无非预期变化）',
  models.filter(m => (m.currency || 'CNY') === 'CNY').every(m => money(monthly(m)) === SNAP[m.id]),
  models.filter(m => (m.currency || 'CNY') === 'CNY' && money(monthly(m)) !== SNAP[m.id]).map(m => m.id + ':' + money(monthly(m))).join(',') || '全部一致');
R.check('T12d 高档输入成本显著高于低档（不会无条件套用低档价）',
  monthly(mm, { calls: 100, inTok: 600000, outTok: 800, hit: 0.3 }) > monthly(mm) * 100);

/* T13 时间语义分离：verifiedAt 仅全核验；price/spec 核验时间独立；contentUpdatedAt 反映内容变更 */
R.check('T13 每款模型四种时间字段齐全且为合法 YYYY-MM-DD',
  models.every(m => ['verifiedAt', 'priceVerifiedAt', 'specVerifiedAt', 'contentUpdatedAt'].every(k => /^\d{4}-\d{2}-\d{2}$/.test(m[k] || ''))));
R.check('T13b VERIFIED 模型的价格与规格核验时间同日（部分核验不伪装全部）',
  models.filter(m => m.verifiedAt === '2026-10-28').every(m => m.priceVerifiedAt === '2026-10-28' && m.specVerifiedAt === '2026-10-28'));
R.check('T13c PARTIAL 模型规格核验时间保持 2026-09-18',
  models.filter(m => m.verifiedAt !== '2026-10-28').every(m => m.specVerifiedAt === '2026-09-18'));
const dsChanged = models.filter(m => m.id.startsWith('deepseek'));
R.check('T13d sourceUrl 实质变更的模型 contentUpdatedAt 已更新（deepseek 两款=2026-10-28）',
  dsChanged.every(m => m.contentUpdatedAt === '2026-10-28' && m.verifiedAt === '2026-09-18'));

/* T14 多币种：币种字段、汇率折算、未核实汇率拒绝参与计算、未核实价档不产出成本 */
const fxData = JSON.parse(readFileSync(join(DIST, 'assets/data/fx.json'), 'utf8'));
R.check('T14 每款模型币种明确（12 CNY + 5 USD）',
  models.filter(m => m.currency === 'CNY').length === 12 && models.filter(m => m.currency === 'USD').length === 5);
R.check('T14b 折算正确（$0.10 → ¥0.6718，按 2026-10-23 中间价 6.718）',
  Math.abs(toBase(0.1, 'USD', fxData) - 0.6718) < 1e-9 && fxEntry(fxData, 'USD').rateDate === '2026-10-23');
R.check('T14c 未核实汇率不参与计算（缺 source/rateDate/verifiedAt/rate<=0 均返回 null）',
  toBase(1, 'USD', { rates: { USD_CNY: { rate: 6.7 } } }) === null &&
  toBase(1, 'USD', { rates: { USD_CNY: { rate: 6.7, rateDate: '2026-10-23' } } }) === null &&
  toBase(1, 'USD', { rates: { USD_CNY: { rate: 0, rateDate: '2026-10-23', verifiedAt: '2026-10-28', source: 'x' } } }) === null &&
  toBase(1, 'USD', { rates: { USD_CNY: { rate: -1, rateDate: '2026-10-23', verifiedAt: '2026-10-28', source: 'x' } } }) === null);
R.check('T14d 未核实价档不产出成本（OpenAI >272K 为 NaN；≤272K 正常）',
  models.filter(m => m.priceTiers && m.priceTiers.some(t => t.unverified)).length === 2 &&
  models.filter(m => m.priceTiers && m.priceTiers.some(t => t.unverified)).every(m =>
    Number.isNaN(monthly(m, { calls: 100, inTok: 600000, outTok: 800, hit: 0.3 })) && !Number.isNaN(monthly(m))));
R.check('T14e Haiku 5.5 双档均经官方核验（≤100K / >100K 自动选档）',
  (function () { const h = models.find(m => m.id === 'claude-haiku-5-5');
    return h.priceTiers.length === 2 && !h.priceTiers[1].unverified &&
      tierFor(h, 102400).priceIn === 0.1 && tierFor(h, 102401).priceIn === 0.5; })());
R.check('T14f monthlyBase 折算为 CNY（USD 模型返回折算值，CNY 模型原值）',
  monthlyBase(models.find(m => m.id === 'gpt-6-luna'), fxData) > 0 &&
  monthlyBase(models.find(m => m.id === 'glm-53'), fxData) === monthly(models.find(m => m.id === 'glm-53')));

/* T3b 页面无价格硬编码（cost 页脚本除 models.json 外不应出现价格数字字面量） */
const costHtml = readFileSync(join(DIST, 'cost/index.html'), 'utf8');
const scriptPart = costHtml.split('<script>').pop();
const priceLiterals = scriptPart.match(/[^a-zA-Z](0\.04|0\.02|0\.3[^0-9]|0\.15|priceIn\s*[:=]\s*[\d.])/g);
R.check('T3b cost 页脚本无价格硬编码', !priceLiterals, priceLiterals ? JSON.stringify(priceLiterals) : '无字面量');

R.summary();
