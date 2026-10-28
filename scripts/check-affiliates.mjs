/**
 * 联盟合作数据与展示规则校验（dist/assets/data/partners.json 为唯一数据源）：
 *  A1~A3  数据 schema / 状态机 / 无秘密字段
 *  A4     展示规则：未批准项目不出现在任何公开页面；active 必须展示且 rel 合规
 *  A5     渲染库安全闸（affiliate.mjs：非 active / 缺 referralUrl / 缺披露 → 空串）
 *  A6     价格与排序不受联盟数据影响（引用 selftest 快照 + 构建数据源唯一性）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';
import { loadJson } from './lib/manifest.mjs';
import { safeUrl } from './lib/escape.mjs';
import { affiliateCtaHtml } from './lib/affiliate.mjs';

const R = createReporter('check-affiliates');
const data = loadJson('assets/data/partners.json');
R.check('A1 partners.json 结构合法（partners 为数组）', Array.isArray(data.partners));

const list = data.partners || [];
const STATUSES = ['candidate', 'applied', 'approved', 'active', 'paused'];
const SECRET_RE = /secret|token|api_?key|password|credential|appkey/i;

let schemaBad = [];
for (const p of list) {
  if (!p.partnerId || !p.name || !p.category) schemaBad.push(`${p.partnerId || '?'}（缺 partnerId/name/category）`);
  if (list.filter(x => x.partnerId === p.partnerId).length > 1) schemaBad.push(`${p.partnerId}（partnerId 重复）`);
  if (!safeUrl(p.officialUrl)) schemaBad.push(`${p.partnerId}（officialUrl 非法）`);
  if (!safeUrl(p.officialTermsUrl)) schemaBad.push(`${p.partnerId}（officialTermsUrl 非法，须指向官方联盟条款页）`);
  if (!STATUSES.includes(p.status)) schemaBad.push(`${p.partnerId}（status 须为 ${STATUSES.join('/')}）`);
  if (p.commissionTerms != null && typeof p.commissionTerms !== 'string') schemaBad.push(`${p.partnerId}（commissionTerms 须为字符串或 null）`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerifiedAt || '')) schemaBad.push(`${p.partnerId}（lastVerifiedAt 缺失或非法）`);
  if (!p.verifiedBy) schemaBad.push(`${p.partnerId}（verifiedBy 缺失）`);
  if (!Array.isArray(p.placements)) schemaBad.push(`${p.partnerId}（placements 须为数组）`);
  if (Object.keys(p).some(k => SECRET_RE.test(k))) schemaBad.push(`${p.partnerId}（疑似秘密字段，禁止写入公开数据）`);
  const ref = safeUrl(p.referralUrl);
  if (p.status === 'active') {
    /* 展示门槛：active 必须有真实推广链接、披露文案与投放位置 */
    if (!ref) schemaBad.push(`${p.partnerId}（active 必须有有效 referralUrl）`);
    else if (ref === safeUrl(p.officialUrl)) schemaBad.push(`${p.partnerId}（referralUrl 不得与 officialUrl 相同）`);
    if (!p.disclosureText) schemaBad.push(`${p.partnerId}（active 必须有 disclosureText）`);
    if (!p.placements.length) schemaBad.push(`${p.partnerId}（active 必须登记 placements）`);
  } else if (p.referralUrl != null && !ref) {
    schemaBad.push(`${p.partnerId}（referralUrl 非空但非法）`);
  }
}
R.check('A2 合作数据 schema / 五态状态机 / 链接分离 / 无秘密数据', schemaBad.length === 0, schemaBad.join(' | ') || `${list.length} 条记录合规`);
R.check('A3 partnerId 无重复', new Set(list.map(p => p.partnerId)).size === list.length);

/* A4 展示规则核对：扫描 dist 全部 HTML 的链接 */
function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}
const htmlFiles = walk(DIST);
const allLinks = [];
for (const f of htmlFiles) {
  const t = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of t.matchAll(/<a\s[^>]*href="([^"]+)"([^>]*)>/g)) allLinks.push({ file: f, href: m[1], attrs: m[2] });
}
let displayBad = [];
const activeList = list.filter(p => p.status === 'active');
/* 禁止的是未批准项目的推广链接（referralUrl）；官方主页/文档链接属于正常编辑引用，任何状态都允许 */
const nonActiveReferrals = list.filter(p => p.status !== 'active')
  .map(p => safeUrl(p.referralUrl)).filter(Boolean);
for (const l of allLinks) {
  if (nonActiveReferrals.includes(l.href)) displayBad.push(`未批准项目的推广链接出现在 ${l.file}（${l.href}）`);
}
for (const p of activeList) {
  const hits = allLinks.filter(l => l.href === safeUrl(p.referralUrl));
  if (!hits.length) { displayBad.push(`${p.partnerId} 为 active 但站内无任何推广链接`); continue; }
  for (const h of hits) {
    if (!/rel="[^"]*\bsponsored\b/.test(h.attrs)) displayBad.push(`${p.partnerId} 链接缺 rel=sponsored（${h.file}）`);
    if (!/rel="[^"]*noopener/.test(h.attrs)) displayBad.push(`${p.partnerId} 链接缺 rel=noopener（${h.file}）`);
  }
}
/* 孤儿联盟链接：站内所有 sponsored 链接必须属于某个 active 项目 */
const sponsored = allLinks.filter(l => /\bsponsored\b/.test(l.attrs));
for (const l of sponsored) {
  if (!activeList.some(p => safeUrl(p.referralUrl) === l.href)) displayBad.push(`孤儿联盟链接（无对应 active 合作）：${l.href}`);
}
R.check('A4 展示规则：未批准项目零展示 / active 链接 sponsored+noopener / 无孤儿联盟链接', displayBad.length === 0, displayBad.join(' | ') || (activeList.length ? `${activeList.length} 个 active 项目全部合规` : '当前无 active 合作，站内 0 推广链接（符合预期）'));

/* A5 渲染库安全闸：非 active / 缺 referralUrl / 缺披露 一律返回空串 */
const sample = list.find(p => p.status === 'candidate') || { partnerId: 'x', status: 'candidate' };
const fakeActiveNoUrl = { partnerId: 'y', status: 'active', officialUrl: 'https://a.example/', referralUrl: null, disclosureText: 'd' };
const fakeActiveNoDisclosure = { partnerId: 'z', status: 'active', officialUrl: 'https://a.example/', referralUrl: 'https://a.example/r', disclosureText: '' };
const fakePaused = { ...fakeActiveNoUrl, partnerId: 'w', status: 'paused', referralUrl: 'https://a.example/r', disclosureText: 'd' };
R.check('A5 affiliate.mjs 安全闸：candidate/active-无链接/active-无披露/paused 均输出空串',
  !affiliateCtaHtml(sample) && !affiliateCtaHtml(fakeActiveNoUrl) && !affiliateCtaHtml(fakeActiveNoDisclosure) && !affiliateCtaHtml(fakePaused));

/* A6 商业中立：价格与排序的唯一来源仍是 models.json（模型表渲染与联盟/广告渲染相互独立） */
const placementSrc = readFileSync(new URL('./lib/placement.mjs', import.meta.url), 'utf8');
R.check('A6 价格/排序不受联盟数据影响（placement.mjs 中联盟/广告渲染独立于模型数据，且 selftest T12c 价格快照回归兜底）',
  placementSrc.includes('affiliateCtaHtml(byId(partners, id))') && placementSrc.includes('adSlotHtml(adsCfg, id)') && !affiliateCtaHtml(sample));

R.summary();
