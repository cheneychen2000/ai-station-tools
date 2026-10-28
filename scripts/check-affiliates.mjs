/**
 * 联盟合作数据校验（dist/assets/data/partners.json，schema 预留模块）。
 * 当前无已确认合作项目：partners 为空数组时 schema 检查通过，链接级检查标记 NOT RUN。
 */
import { DIST } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadJson } from './lib/manifest.mjs';
import { safeUrl } from './lib/escape.mjs';

const R = createReporter('check-affiliates');
const data = loadJson('assets/data/partners.json');
R.check('A1 partners.json 结构合法（partners 为数组）', Array.isArray(data.partners));

const list = data.partners || [];
R.check('A2 产品 ID 无重复', new Set(list.map(p => p.id)).size === list.length);

const SECRET_RE = /secret|token|api_?key|password|credential|appkey/i;
let schemaBad = [];
for (const p of list) {
  if (!p.id || !p.name || !p.category) schemaBad.push(`${p.id || '?'}（缺 id/name/category）`);
  if (!safeUrl(p.officialUrl)) schemaBad.push(`${p.id}（officialUrl 非法）`);
  if (!['candidate', 'active'].includes(p.status)) schemaBad.push(`${p.id}（status 须为 candidate/active）`);
  if (Object.keys(p).some(k => SECRET_RE.test(k))) schemaBad.push(`${p.id}（疑似秘密字段，禁止写入公开数据）`);
  if (p.affiliateUrl != null) {
    if (p.status !== 'active') schemaBad.push(`${p.id}（未获批项目不得填 affiliateUrl）`);
    if (!safeUrl(p.affiliateUrl)) schemaBad.push(`${p.id}（affiliateUrl 非法）`);
    if (p.affiliateUrl === p.officialUrl) schemaBad.push(`${p.id}（联盟链接与官方链接必须分开）`);
  }
  if (p.status === 'active' && !p.verifiedAt) schemaBad.push(`${p.id}（正式合作须记录核验日期）`);
}
R.check('A3 合作数据 schema / 状态 / 链接分离 / 无秘密数据', schemaBad.length === 0, schemaBad.join(' | ') || `${list.length} 条记录合规`);

if (list.length === 0) {
  R.notRun('A4 联盟链接披露与 rel=sponsored 页面检查', '当前无任何合作项目，无页面展示联盟链接');
} else {
  R.warn('A4 联盟链接披露与 rel=sponsored 页面检查', '存在合作数据，需在展示页面上人工核对披露文案与 rel 属性');
}
R.summary();
