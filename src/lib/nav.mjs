/**
 * 全站统一导航模板：build.mjs 生成页与手写页（NAV_START/NAV_END 注入）的唯一来源。
 * 新增/改名/改序导航项只改本文件。所有链接为站内相对路径（base 前缀），404 用根绝对路径（base='/'）。
 */
import { BRAND } from './paths.mjs';
import { esc } from './escape.mjs';

/**
 * 主导航项（顺序即全站展示顺序；品牌链接承担"首页"入口）。
 * 中英两站都从**这一份数组**渲染：labelEn/pathEn 与 label/path 必须成对填写，
 * 少了任何一侧都会被 scripts/check-nav.mjs 的 N0 断言拦下（历史问题：英文导航曾经是
 * 手写的三条独立数组，中文加菜单后英文长期没跟上）。
 */
export const NAV_ITEMS = [
  { key: 'cost', label: '成本计算器', labelEn: 'Cost Calculator', path: 'cost/', pathEn: 'en/cost/' },
  { key: 'models', label: '模型库', labelEn: 'Model Library', path: 'models/', pathEn: 'en/models/' },
  { key: 'compare', label: '模型对比', labelEn: 'Model Comparison', path: 'compare/', pathEn: 'en/compare/' },
  { key: 'guides', label: '开发指南', labelEn: 'Developer Guide', path: 'guides/', pathEn: 'en/guides/' },
  { key: 'tools', label: 'AI 工具目录', labelEn: 'AI Tools Directory', path: 'tools/', pathEn: 'en/tools/' },
  { key: 'prompts', label: 'Prompt 资源', labelEn: 'Prompt Resources', path: 'prompts/', pathEn: 'en/prompts/' }
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

/* ---------- 语言切换器（中英共用一份实现，只换文案） ----------
   结构：地球图标 + 当前语言 + 箭头按钮；点击展开两项菜单（当前语言带勾选、另一语言为链接）。
   交互由 assets/app.js 的 langSwitcher() 接管（展开/收起、点击外部、Escape、键盘方向键、
   以 fixed 定位贴住按钮避免被导航横向滚动容器裁切）；无 JS 时 <noscript> 里的样式把菜单
   直接平铺出来，语言切换依然可用。
   注意：菜单里的另一语言仍是 <a class="lang-switch" href="…">，即"每页恰一条语言切换链接"
   的既有约定与 app.js 的语言偏好记忆（rh_lang_pref）都保持不变。 */
const LANG_SWITCH_UI = {
  zh: { current: '中文', other: 'English', aria: '语言：中文，点击切换语言', menu: '选择语言' },
  en: { current: 'English', other: '中文', aria: 'Language: English, click to switch', menu: 'Select language' }
};

/* ---------- 移动端汉堡按钮 ----------
   ≤768px 时导航不再是"整行 + 横向滚动"，而是收起成按钮 + 纵向面板（面板即 <nav> 内的 <ul>，
   id="siteMenu"，由 assets/app.js 的 navToggle() 控制 .is-open / aria-expanded）。
   桌面端该按钮 display:none，不参与布局，也不改变既有的 space-between 排列。 */
const NAV_TOGGLE_UI = {
  zh: { open: '打开导航菜单', close: '关闭导航菜单' },
  en: { open: 'Open navigation menu', close: 'Close navigation menu' }
};

function navToggleHtml(ui) {
  return `<button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteMenu" aria-label="${esc(ui.open)}" data-label-open="${esc(ui.open)}" data-label-close="${esc(ui.close)}"><span class="nav-toggle-icon" aria-hidden="true"></span></button>`;
}

const ICON_GLOBE = '<svg class="lang-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">'
  + '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/>'
  + '<path d="M1.9 8h12.2M8 1.9c1.7 1.8 2.5 3.9 2.5 6.1S9.7 12.3 8 14.1C6.3 12.3 5.5 10.2 5.5 8s.8-4.3 2.5-6.1Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const ICON_CARET = '<svg class="lang-caret" viewBox="0 0 10 6" width="8" height="5" aria-hidden="true" focusable="false">'
  + '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CHECK = '<svg class="lang-check" viewBox="0 0 12 10" width="11" height="10" aria-hidden="true" focusable="false">'
  + '<path d="M1 5.2 4.2 8.3 11 1.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** 语言切换器的整段 <li>（zh/en 仅文案不同） */
function langSwitchItemHtml(switchHref, ui) {
  return `          <li class="lang-switch-item">
            <div class="lang-switch-wrap">
              <button type="button" class="lang-btn" id="langBtn" aria-haspopup="true" aria-expanded="false" aria-controls="langMenu" aria-label="${esc(ui.aria)}">${ICON_GLOBE}<span class="lang-cur">${esc(ui.current)}</span>${ICON_CARET}</button>
              <ul class="lang-menu" id="langMenu" role="menu" aria-label="${esc(ui.menu)}">
                <li class="lang-opt is-current" role="none"><span class="lang-opt-cur" role="menuitemradio" aria-checked="true" aria-current="true" tabindex="-1">${ICON_CHECK}<span>${esc(ui.current)}</span></span></li>
                <li class="lang-opt" role="none"><a class="lang-switch" href="${esc(switchHref)}" role="menuitemradio" aria-checked="false">${esc(ui.other)}</a></li>
              </ul>
              <noscript><style>.lang-btn{display:none}.lang-menu{display:block;position:static;margin-top:6px;box-shadow:none}</style></noscript>
            </div>
          </li>`;
}

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
  if (switchHref) items.push(langSwitchItemHtml(switchHref, LANG_SWITCH_UI.zh));
  return `<a class="skip-link" href="#main">跳到正文</a>
  <header class="topbar">
    <div class="wrap topbar-row">
      <a class="brand" href="${brandHref}"${homeCur}><img class="brand-logo" src="${base}assets/logo.png" alt="${esc(BRAND)}" width="160" height="39"></a>
      ${navToggleHtml(NAV_TOGGLE_UI.zh)}
      <nav class="site-nav" aria-label="主导航">
        <ul id="siteMenu">
${items.join('\n')}
        </ul>
      </nav>
    </div>${crumb ? `
    <div class="wrap crumb-row"><span class="crumb">${crumb}</span></div>` : ''}
  </header>`;
}

/**
 * 英文站主导航：**由 NAV_ITEMS 派生**（六个业务项），末项为语言切换器。
 * 与中文站共享同一份顺序与栏目，只换文案与 /en/ 前缀，避免两套菜单再次分叉。
 * 首页入口与中文站一致，由品牌 Logo 承担（`active === 'home'` 时给品牌链接加 aria-current），
 * 导航列表里不再单列 Home —— 两端菜单项一一对应、数量完全相同。
 * 每个业务项都指向真实存在的英文页（en/models / en/cost / en/compare / en/guides / en/tools / en/prompts）。
 * @param base 相对根路径前缀（'../' × depth）
 * @param active 'home'（品牌高亮）| NAV_ITEMS.key（cost/models/compare/guides/tools/prompts）
 * @param switchHref 中文切换目标（switchTarget 计算）
 */
export function navHeaderHtmlEn(base, active = null, crumb = '', switchHref = null) {
  const items = NAV_ITEMS.map(it => ({ key: it.key, label: it.labelEn, path: `${base}${it.pathEn}` }));
  const lis = items.map(it => {
    const cur = active === it.key ? ' class="active" aria-current="page"' : '';
    return `          <li><a href="${it.path}"${cur}>${esc(it.label)}</a></li>`;
  });
  if (switchHref) lis.push(langSwitchItemHtml(switchHref, LANG_SWITCH_UI.en));
  const homeCur = active === 'home' ? ' aria-current="page"' : '';
  const brandHref = base === '../' ? './' : `${base}en/`;
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="wrap topbar-row">
      <a class="brand" href="${brandHref}"${homeCur}><img class="brand-logo" src="${base}assets/logo.png" alt="${esc(BRAND)}" width="160" height="39"></a>
      ${navToggleHtml(NAV_TOGGLE_UI.en)}
      <nav class="site-nav" aria-label="Main navigation">
        <ul id="siteMenu">
${lis.join('\n')}
        </ul>
      </nav>
    </div>${crumb ? `
    <div class="wrap crumb-row"><span class="crumb">${crumb}</span></div>` : ''}
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
