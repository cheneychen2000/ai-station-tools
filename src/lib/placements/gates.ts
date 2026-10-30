/**
 * 联盟/广告安全闸（唯一判定出口，与 scripts/lib 下供检查脚本使用的副本同规则）。
 * 只负责"是否允许输出 + 输出所需数据"，HTML 由 components/placements 下的 Astro 组件生成。
 */
import { safeUrl } from '../utils/escape';
import type { Partner, AdsConfig } from '../data/schemas';

export const isValidPublisherId = (s: unknown): boolean => typeof s === 'string' && /^ca-pub-\d{16}$/.test(s);

/**
 * 联盟 CTA 闸门：仅 status==='active' 且 referralUrl 通过 safeUrl 校验、
 * 与 officialUrl 不同、且存在 disclosureText 时才允许输出；
 * 其余状态（candidate/applied/approved/paused）一律不输出——未批准项目不在公开页面显示。
 */
export function affiliateCtaAllowed(p: Partner | null | undefined): { url: string; name: string; disclosureText: string; partnerId: string } | null {
  if (!p || p.status !== 'active') return null;
  const url = safeUrl(p.referralUrl);
  if (!url || url === safeUrl(p.officialUrl)) return null;
  if (!p.disclosureText) return null;
  return { url, name: p.name, disclosureText: p.disclosureText, partnerId: p.partnerId };
}

/** 按 partnerId 取对象（缺失返回 null，调用方按不输出处理） */
export const partnerById = (partners: Partner[] | null | undefined, id: string): Partner | null =>
  (partners || []).find(p => p.partnerId === id) || null;

/**
 * 广告位闸门：仅 enabled===true 且 publisherId 为正式格式（ca-pub-16位数字）
 * 且 slots 登记了该位置时才允许输出占位容器；其余任何情况不输出。
 * 真正加载 adsense 脚本的运行时闸门在浏览器端 app 模块（另加生产域名与 CMP 同意两道闸）。
 */
export function adSlotAllowed(cfg: AdsConfig | null | undefined, name: string): { name: string; format: string } | null {
  if (!cfg || cfg.enabled !== true || !isValidPublisherId(cfg.publisherId)) return null;
  const slot = cfg.slots && cfg.slots[name];
  if (!slot) return null;
  return { name, format: slot.format || 'auto' };
}
