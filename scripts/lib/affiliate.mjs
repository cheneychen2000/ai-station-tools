/**
 * 联盟 CTA 渲染：安全闸规则唯一实现源 = src/lib/placements/gates.ts（组件 AffiliateCTA 与其共用同一判定）。
 * 本文件只保留检查脚本所需的历史 HTML 片段形态（CTA 标记与披露文案），无独立业务规则。
 */
import { affiliateCtaAllowed, partnerById } from '../../src/lib/placements/gates.ts';
import { esc } from './escape.mjs';

export function affiliateCtaHtml(p) {
  const ok = affiliateCtaAllowed(p);
  if (!ok) return '';
  return `<div class="affiliate-cta">
        <a class="btn btn-primary btn-s" href="${esc(ok.url)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate="${esc(ok.partnerId)}">访问 ${esc(ok.name)} 官网 →</a>
        <p class="aff-note">${esc(ok.disclosureText)}</p>
      </div>`;
}

/** 按 partnerId 取对象（缺失返回 null，调用方按空串处理） */
export const byId = partnerById;
