/* Reflex Hub · 全站共享脚本 */
window.ASSETS_BASE = window.ASSETS_BASE || 'assets';

/* 埋点占位：console.debug + dataLayer。当前不接任何统计后端（零第三方脚本）；
   后续接入统计工具时在此函数内单一出口桥接，页面调用点无需改动 */
window.track = function (event, params) {
  try {
    console.debug('[track]', event, params || {});
    (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: event }, params || {}));
  } catch (e) { /* 静默 */ }
};

/* Cloudflare Web Analytics（免费、无 Cookie、境外稳定）：Cloudflare Dashboard → Web Analytics
   添加站点后，把 beacon token 填入下方常量即启用；未配置时零请求零报错 */
window.CF_ANALYTICS_TOKEN = window.CF_ANALYTICS_TOKEN || '';
(function loadCfAnalytics() {
  if (!window.CF_ANALYTICS_TOKEN) return;
  try {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: window.CF_ANALYTICS_TOKEN }));
    document.head.appendChild(s);
  } catch (e) { /* 静默 */ }
})();

/* 页脚：合规文字、核验日期摘要与来源链接全部由 build.mjs 静态写入各页面 HTML（#site-footer），
   不再依赖客户端 fetch models.json；模型价格仍以 models.json 为唯一数据源（构建期读取）。 */
