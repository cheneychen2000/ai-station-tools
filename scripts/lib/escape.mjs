/**
 * HTML / URL / JS / JSON-LD 输出安全工具。
 * 原则：只对动态数据插入 HTML 的位置转义，不对完整模板转义。
 */

/** HTML 文本与双引号属性上下文转义 */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 外部 URL 校验：仅允许 http/https，其余一律返回 null（调用方兜底） */
export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch (e) { /* 非法 URL */ }
  return null;
}

/** 站点内 URL 校验：必须以 https://www.reflex-hub.com 为 origin（用 URL 解析比对，不用字符串前缀） */
export function isSiteUrl(u, site) {
  try {
    return new URL(String(u)).origin === new URL(site).origin;
  } catch (e) {
    return false;
  }
}

/** 值插入内联 <script> 的 JS 字符串字面量（含引号），< 转义防 </script> 闭合 */
export function jsStr(s) {
  return JSON.stringify(String(s)).replace(/</g, '\\u003c');
}

/** JSON-LD 序列化：JSON.stringify + < 转义，保证数据内容无法破坏 script 标签结构 */
export function jsonld(o) {
  return JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
}
