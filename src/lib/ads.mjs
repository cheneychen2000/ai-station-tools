/**
 * 广告位渲染闸（唯一出口）。安全规则：
 *  - 仅 enabled===true 且 publisherId 为正式格式（ca-pub-16位数字）且 slots 登记了该位置时才输出占位容器；
 *  - 其余任何情况输出空串——默认配置下页面零广告标记、零脚本；
 *  - 真正加载 adsense 脚本的运行时闸门在 dist/assets/app.js（另加生产域名与 CMP 同意两道闸）。
 * build.mjs 用本函数处理手写页中的 <!-- ADSLOT:name --> 标记。
 */
import { esc } from './escape.mjs';

export const isValidPublisherId = s => typeof s === 'string' && /^ca-pub-\d{16}$/.test(s);

export function adSlotHtml(cfg, name) {
  if (!cfg || cfg.enabled !== true || !isValidPublisherId(cfg.publisherId)) return '';
  const slot = cfg.slots && cfg.slots[name];
  if (!slot) return '';
  return `<div class="ad-slot" data-ad-slot="${esc(name)}" data-ad-format="${esc(slot.format || 'auto')}"></div>`;
}
