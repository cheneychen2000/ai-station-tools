/**
 * 联盟/广告标记的持久化占位符机制（build.mjs 与状态转换测试共用）。
 * 规则：
 *  - 源文件中的 <!-- AFFILIATE:id --> / <!-- ADSLOT:name -->（或已归一化的 BEGIN/END 形态）
 *    每次构建都被整体重写为 <!-- KIND:id:BEGIN -->[渲染内容]<!-- KIND:id:END -->；
 *  - 未启用时渲染内容为空串，但 BEGIN/END 注释标记保留（HTML 注释不可见）——标记永不丢失，
 *    未来激活/暂停/再激活只需改配置重建；
 *  - 启用时 CTA/容器写在标记对内，下次构建整段替换，天然幂等（不会重复叠加）；
 *  - 渲染安全闸：AFFILIATE 走 affiliate.mjs（仅 active+有效 referralUrl 有输出），
 *    ADSLOT 走 ads.mjs（仅 enabled+正式 Publisher ID 有输出）。
 */
import { affiliateCtaHtml, byId } from './affiliate.mjs';
import { adSlotHtml } from './ads.mjs';

export function replacePlacementMarkers(html, partners, adsCfg) {
  return html.replace(
    /<!-- (AFFILIATE|ADSLOT):([a-z0-9\-]+):BEGIN -->[\s\S]*?<!-- \1:\2:END -->|<!-- (AFFILIATE|ADSLOT):([a-z0-9\-]+) -->/g,
    (m0, k1, id1, k2, id2) => {
      const kind = k1 || k2;
      const id = id1 || id2;
      const inner = kind === 'AFFILIATE' ? affiliateCtaHtml(byId(partners, id)) : adSlotHtml(adsCfg, id);
      return `<!-- ${kind}:${id}:BEGIN -->${inner}\n      <!-- ${kind}:${id}:END -->`;
    }
  );
}
