/**
 * 全站统一导航模板：build.mjs 生成页与手写页（NAV_START/NAV_END 注入）的唯一来源。
 * 新增/改名/改序导航项只改本文件。所有链接为站内相对路径（base 前缀），404 用根绝对路径（base='/'）。
 */
import { BRAND } from './paths.mjs';
import { esc } from './escape.mjs';

/** 主导航项（顺序即全站展示顺序；品牌链接承担"首页"入口） */
export const NAV_ITEMS = [
  { key: 'cost', label: '成本计算器', path: 'cost/' },
  { key: 'models', label: '模型库', path: 'models/' },
  { key: 'compare', label: '模型对比', path: 'compare/' },
  { key: 'tools', label: 'AI 工具目录', path: 'tools/' },
  { key: 'prompts', label: 'Prompt 资源', path: 'prompts/' }
];

/** 页脚"核心工具"额外收录（不在主导航，避免过多项） */
export const FOOTER_EXTRA = [
  { key: 'quiz', label: 'AI 认知测试', path: 'quiz/' }
];

/**
 * 统一 header：跳到正文链接 + 品牌链接（始终回首页）+ 可选面包屑 + 主导航。
 * @param base 相对根路径前缀（'' / '../' / '../../'），404 传 '/' 使用根绝对路径
 * @param active 当前栏目 key（NAV_ITEMS.key 或 'home'），命中项输出 active 类与 aria-current="page"
 * @param crumb 面包屑 HTML（已转义/受信任的模板片段），无则省略
 */
export function navHeaderHtml(base, active = null, crumb = '') {
  const brandHref = base === '/' ? '/' : (base || './');
  const homeCur = active === 'home' ? ' aria-current="page"' : '';
  const items = NAV_ITEMS.map(it => {
    const cur = active === it.key ? ' class="active" aria-current="page"' : '';
    return `          <li><a href="${base}${it.path}"${cur}>${esc(it.label)}</a></li>`;
  }).join('\n');
  return `<a class="skip-link" href="#main">跳到正文</a>
  <header class="topbar">
    <div class="wrap topbar-row">
      <a class="brand" href="${brandHref}"${homeCur}>${BRAND}</a>${crumb ? `
      <span class="crumb">${crumb}</span>` : ''}
      <nav class="site-nav" aria-label="主导航">
        <ul>
${items}
        </ul>
      </nav>
    </div>
  </header>`;
}

/** 页脚站内导航区：核心工具 + 关于本站 + GitHub 反馈（只指向已存在的页面） */
export function footerNavHtml(base) {
  const core = [...NAV_ITEMS, ...FOOTER_EXTRA]
    .map(it => `<a href="${base}${it.path}">${esc(it.label)}</a>`).join(' · ');
  return `<nav class="footer-nav" aria-label="页脚导航">
    <p>核心工具：${core}</p>
    <p><a href="${base}about/">关于本站</a> · <a href="https://github.com/cheneychen2000/ai-station-tools/issues" target="_blank" rel="noopener">GitHub 反馈</a></p>
  </nav>`;
}
