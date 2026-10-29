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
  { key: 'guides', label: '开发指南', path: 'guides/' },
  { key: 'tools', label: 'AI 工具目录', path: 'tools/' },
  { key: 'prompts', label: 'Prompt 资源', path: 'prompts/' }
];

/** 页脚"核心工具"额外收录（不在主导航，避免过多项） */
export const FOOTER_EXTRA = [
  { key: 'quiz', label: 'AI 认知测试', path: 'quiz/' },
  { key: 'guides', label: '计算指南', path: 'guides/' }
];

/** 页脚"站点信息"信任页面 */
export const FOOTER_INFO = [
  { label: '关于本站', path: 'about/' },
  { label: '定价方法论', path: 'pricing-methodology/' },
  { label: '隐私政策', path: 'privacy/' },
  { label: '联盟推广披露', path: 'affiliate-disclosure/' },
  { label: '使用条款', path: 'terms/' }
];

/**
 * 统一 header：跳到正文链接 + 品牌链接（始终回首页）+ 可选面包屑 + 主导航 + 语言切换器。
 * @param base 相对根路径前缀（'' / '../' / '../../'），404 传 '/' 使用根绝对路径
 * @param active 当前栏目 key（NAV_ITEMS.key 或 'home'），命中项输出 active 类与 aria-current="page"
 * @param crumb 面包屑 HTML（已转义/受信任的模板片段），无则省略
 * @param switchHref 语言切换目标（由 scripts/lib/locales.mjs switchTarget 计算，真实存在的页面 URL）
 */
export function navHeaderHtml(base, active = null, crumb = '', switchHref = null) {
  const brandHref = base === '/' ? '/' : (base || './');
  const homeCur = active === 'home' ? ' aria-current="page"' : '';
  const items = NAV_ITEMS.map(it => {
    const cur = active === it.key ? ' class="active" aria-current="page"' : '';
    return `          <li><a href="${base}${it.path}"${cur}>${esc(it.label)}</a></li>`;
  });
  if (switchHref) items.push(`          <li class="lang-switch-item"><a class="lang-switch" href="${esc(switchHref)}">English</a></li>`);
  return `<a class="skip-link" href="#main">跳到正文</a>
  <header class="topbar">
    <div class="wrap topbar-row">
      <a class="brand" href="${brandHref}"${homeCur}><img class="brand-logo" src="${base}assets/logo.png" alt="${esc(BRAND)}" width="160" height="39"></a>${crumb ? `
      <span class="crumb">${crumb}</span>` : ''}
      <nav class="site-nav" aria-label="主导航">
        <ul>
${items.join('\n')}
        </ul>
      </nav>
    </div>
  </header>`;
}

/**
 * 英文站主导航：只链接真实存在的英文页，末项为语言切换器（switchHref 由路由映射计算）。
 * 与 dist/en/ 手写页内联导航同结构（顺序/文案由 check-nav N1 的 EN_NAV_LABELS 强制一致）。
 * @param base 相对根路径前缀（'../' × depth）
 * @param active 'home' | 'cost' | 'model'
 * @param switchHref 中文切换目标（switchTarget 计算）
 */
export function navHeaderHtmlEn(base, active = null, crumb = '', switchHref = null) {
  const items = [
    { key: 'home', label: 'Home', path: `${base}en/` },
    { key: 'cost', label: 'Cost Calculator', path: `${base}en/cost/` },
    { key: 'model', label: 'Model Library', path: `${base}en/models/` }
  ];
  const lis = items.map(it => {
    const cur = active === it.key && it.key !== 'home' ? ' class="active" aria-current="page"' : '';
    return `          <li><a href="${it.path}"${cur}>${esc(it.label)}</a></li>`;
  });
  if (switchHref) lis.push(`          <li class="lang-switch-item"><a class="lang-switch" href="${esc(switchHref)}">中文</a></li>`);
  const homeCur = active === 'home' ? ' aria-current="page"' : '';
  const brandHref = base === '../' ? './' : `${base}en/`;
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="wrap topbar-row">
      <a class="brand" href="${brandHref}"${homeCur}><img class="brand-logo" src="${base}assets/logo.png" alt="${esc(BRAND)}" width="160" height="39"></a>${crumb ? `
      <span class="crumb">${crumb}</span>` : ''}
      <nav class="site-nav" aria-label="Main navigation">
        <ul>
${lis.join('\n')}
        </ul>
      </nav>
    </div>
  </header>`;
}

/** 页脚站内导航区：核心工具 + 关于本站 + GitHub 反馈（只指向已存在的页面） */
export function footerNavHtml(base) {
  const core = [...NAV_ITEMS, ...FOOTER_EXTRA]
    .map(it => `<a href="${base}${it.path}">${esc(it.label)}</a>`).join(' · ');
  const info = FOOTER_INFO.map(it => `<a href="${base}${it.path}">${esc(it.label)}</a>`).join(' · ');
  return `<nav class="footer-nav" aria-label="页脚导航">
    <p>核心工具：${core}</p>
    <p>站点信息：${info}</p>
    <p><a href="https://github.com/cheneychen2000/ai-station-tools/issues" target="_blank" rel="noopener">GitHub 反馈</a></p>
  </nav>`;
}
