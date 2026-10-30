/**
 * HTML / URL / JS / JSON-LD 输出安全工具。
 * 原则：Astro 模板插值负责常规文本/属性转义；本模块只保留 Astro 插值覆盖不到的场景
 * （placement 标记片段等需整段序列化的位置、外部 URL 校验、内联 script 字符串字面量、JSON-LD 序列化）。
 */

/** HTML 文本与双引号属性上下文转义（placement 片段等 set:html 边界使用） */
export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 外部 URL 校验：仅允许 http/https，其余一律返回 null（调用方兜底） */
export function safeUrl(u: unknown): string | null {
  try {
    const url = new URL(String(u));
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch { /* 非法 URL */ }
  return null;
}

/** 站点内 URL 校验：必须以 https://www.reflex-hub.com 为 origin（用 URL 解析比对，不用字符串前缀） */
export function isSiteUrl(u: unknown, site: string): boolean {
  try {
    return new URL(String(u)).origin === new URL(site).origin;
  } catch {
    return false;
  }
}

/** 值插入内联 <script> 的 JS 字符串字面量（含引号），< 转义防 </script> 闭合 */
export function jsStr(s: unknown): string {
  return JSON.stringify(String(s)).replace(/</g, '\\u003c');
}

/** JSON-LD 序列化：JSON.stringify + < 转义，保证数据内容无法破坏 script 标签结构 */
export function jsonld(o: unknown): string {
  return JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
}
