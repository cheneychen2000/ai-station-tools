/**
 * 联盟 CTA 渲染（唯一出口）。安全规则：
 *  - 仅 status==='active' 且 referralUrl 通过 safeUrl 校验且存在 disclosureText 时才输出 CTA；
 *  - 其余状态（candidate/applied/approved/paused）一律输出空串——未批准项目不在公开页面显示；
 *  - 链接固定 rel="sponsored nofollow noopener" target="_blank"，披露文案随链接就近展示。
 * build.mjs 用本函数处理手写页中的 <!-- AFFILIATE:<partnerId> --> 标记。
 */
import { esc, safeUrl } from './escape.mjs';

export function affiliateCtaHtml(p) {
  if (!p || p.status !== 'active') return '';
  const url = safeUrl(p.referralUrl);
  if (!url || url === safeUrl(p.officialUrl)) return '';
  if (!p.disclosureText) return '';
  return `<div class="affiliate-cta">
        <a class="btn btn-primary btn-s" href="${esc(url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate="${esc(p.partnerId)}">访问 ${esc(p.name)} 官网 →</a>
        <p class="aff-note">${esc(p.disclosureText)}</p>
      </div>`;
}

/** 按 partnerId 取对象（缺失返回 null，调用方按空串处理） */
export const byId = (partners, id) => (partners || []).find(p => p.partnerId === id) || null;
