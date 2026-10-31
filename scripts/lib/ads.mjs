/**
 * 广告位渲染：安全闸规则唯一实现源 = src/lib/placements/gates.ts（组件 AdSlot 与其共用同一判定）。
 * 本文件只保留检查脚本所需的历史 HTML 片段形态（占位容器标记），无独立业务规则。
 */
import { isValidPublisherId, adSlotAllowed } from '../../src/lib/placements/gates.ts';
import { esc } from './escape.mjs';

export { isValidPublisherId };

export function adSlotHtml(cfg, name) {
  const ok = adSlotAllowed(cfg, name);
  if (!ok) return '';
  return `<div class="ad-slot" data-ad-slot="${esc(ok.name)}" data-ad-format="${esc(ok.format)}"></div>`;
}
