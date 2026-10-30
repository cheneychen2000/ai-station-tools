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

/* Google AdSense 运行时加载闸（默认全关，当前配置下永不加载）：
   仅当以下四个条件全部满足才请求 adsense 脚本，任一不满足 → 零请求：
   1) assets/data/ads.json 中 enabled === true；
   2) publisherId 为正式获批格式 ca-pub-16位数字（猜测/占位 ID 一律拒绝）；
   3) 运行域名为生产域 www.reflex-hub.com——本地开发、Cloudflare 预览/测试域名一律不加载；
   4) CMP 状态为 google-certified 且存在同意信号（向 EEA/英国/瑞士投放个性化广告的合规前提；
      未部署 Google 认证 CMP 前不得开启 enabled）。
   不自动刷新、不预点击、不在计算器交互流程内渲染广告。 */
(function loadAdsGate() {
  if (location.hostname !== 'www.reflex-hub.com') return;
  fetch(window.ASSETS_BASE + '/data/ads.json')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (!cfg || cfg.enabled !== true) return;
      if (typeof cfg.publisherId !== 'string' || !/^ca-pub-\d{16}$/.test(cfg.publisherId)) return;
      if (!cfg.cmp || cfg.cmp.status !== 'google-certified') return;
      var s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.publisherId);
      document.head.appendChild(s);
    })
    .catch(function () { /* 静默：广告配置不可用时零副作用 */ });
})();

/* 语言推荐（非强制、可关闭）：优先级=本次显式点击 > 已保存偏好 > 浏览器语言 > 默认中文。
   切换链接由构建期路由映射计算，只在目标语言页面真实存在时才出现；绝不自动重定向。
   localStorage 仅在用户点击语言切换时写入；读取失败/不可用一律静默降级，不影响页面功能。 */
(function langHint() {
  var switchLink = document.querySelector('a.lang-switch');
  if (!switchLink) return;
  var current = document.documentElement.lang || 'zh-CN';
  /* 显式选择 = 点击切换链接：记录目标语言偏好（写失败不影响跳转） */
  function bindChoice(link) {
    link.addEventListener('click', function () {
      try { localStorage.setItem('rh_lang_pref', current === 'en' ? 'zh-CN' : 'en'); } catch (e) { /* 静默 */ }
    });
  }
  bindChoice(switchLink);
  var pref = null, dismissed = false;
  try { pref = localStorage.getItem('rh_lang_pref'); } catch (e) { /* 不可用 */ }
  try { dismissed = sessionStorage.getItem('rh_lang_hint_off') === '1'; } catch (e) { /* 不可用 */ }
  if (dismissed) return;
  var browser = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  /* 当前中文页：保存过英文偏好、或无偏好且浏览器为英语 → 推荐英文；其余（含中文/其他语言浏览器）默认中文不打扰 */
  var showToEn = current !== 'en' && (pref === 'en' || (!pref && /^en/i.test(browser)));
  /* 当前英文页：仅当保存过中文偏好才推荐回中文 */
  var showToZh = current === 'en' && pref === 'zh-CN';
  if (!showToEn && !showToZh) return;
  var bar = document.createElement('div');
  bar.className = 'lang-hint';
  bar.setAttribute('role', 'note');
  var text = document.createElement('span');
  text.textContent = showToEn ? 'This page is also available in English.' : '本页面提供中文版本。';
  var go = document.createElement('a');
  go.className = 'lang-switch';
  go.href = switchLink.getAttribute('href');
  go.textContent = showToEn ? 'English →' : '中文 →';
  bindChoice(go);
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'lang-hint-close';
  close.setAttribute('aria-label', showToEn ? 'Dismiss' : '关闭');
  close.textContent = '×';
  close.addEventListener('click', function () {
    bar.remove();
    try { sessionStorage.setItem('rh_lang_hint_off', '1'); } catch (e) { /* 静默 */ }
  });
  bar.appendChild(text);
  bar.appendChild(go);
  bar.appendChild(close);
  document.body.appendChild(bar);
})();

/* 语言切换器（顶部导航）：点击展开两项菜单（当前语言带勾选、另一语言为链接）。
   菜单用 position: fixed 跟随按钮定位并按视口夹紧，因此既不会被导航的横向滚动容器裁切，
   也不会超出屏幕右侧；展开/收起不改变文档流，顶栏高度与业务导航布局都不受影响。
   支持：点击切换、点击外部关闭、Escape 关闭、↑/↓ 在菜单项间移动、Tab 自然进出。
   语言目标 URL 由构建期（locales.mjs switchTarget）算好，前端只跳转、不拼 URL。 */
(function langSwitcher() {
  var btn = document.getElementById('langBtn');
  var menu = document.getElementById('langMenu');
  if (!btn || !menu) return;
  var isOpen = false;

  /* 菜单项：当前语言（不可点选）+ 另一语言（链接） */
  function items() {
    return Array.prototype.slice.call(menu.querySelectorAll('[role^="menuitem"]'));
  }

  /* 以按钮为锚点定位：优先向下、空间不足则向上，水平按视口夹紧 */
  function place() {
    var r = btn.getBoundingClientRect();
    var w = menu.offsetWidth || 144;
    var h = menu.offsetHeight || 44;
    var gap = 8;
    var left = Math.min(r.right - w, window.innerWidth - w - 8);
    left = Math.max(8, left);
    var top = r.bottom + gap;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
  }

  function setOpen(open, focusFirst) {
    if (isOpen === open) return;
    isOpen = open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.classList.toggle('is-open', open);
    if (open) {
      place();
      if (focusFirst) {
        var list = items();
        if (list.length > 1 && list[1].focus) list[1].focus();
      }
    }
  }

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    setOpen(!isOpen, false);
  });

  /* 点击菜单项（另一语言链接）后先收起，跳转由 <a> 自身完成 */
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false, false);
  });

  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (btn.contains(e.target) || menu.contains(e.target)) return;
    setOpen(false, false);
  });

  document.addEventListener('keydown', function (e) {
    if (!isOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      setOpen(false, false);
      btn.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      var list = items().filter(function (el) { return el.tabIndex !== -1 || el.tagName === 'A'; });
      if (!list.length) return;
      var idx = list.indexOf(document.activeElement);
      var next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
      if (next < 0) next = list.length - 1;
      if (next >= list.length) next = 0;
      list[next].focus();
      e.preventDefault();
    }
  });

  /* 视口变化时跟随（滚动/缩放）：菜单是 fixed 定位，不跟随会产生"飘在空中"的错觉 */
  window.addEventListener('resize', function () { if (isOpen) place(); });
  window.addEventListener('scroll', function () { if (isOpen) place(); }, true);
})();

/* 移动端导航（≤768px）：汉堡按钮展开/收起纵向导航面板（面板 = <nav> 内的 #siteMenu）。
   与语言切换器是两个独立面板：
   - Escape 用捕获阶段处理，先判断语言菜单是否开着——开着就交给它关，避免一次按键关两层；
   - 点击外部同时收起两者；面板收起时也顺手收掉语言菜单，避免留下悬空面板；
   - 桌面端按钮 display:none，这段逻辑不产生任何影响。 */
(function navToggle() {
  var btn = document.getElementById('navToggle');
  var menu = document.getElementById('siteMenu');
  var nav = menu && menu.closest ? menu.closest('.site-nav') : null;
  if (!btn || !menu || !nav) return;
  var langBtn = document.getElementById('langBtn');
  var langMenu = document.getElementById('langMenu');
  var openLabel = btn.getAttribute('data-label-open') || btn.getAttribute('aria-label') || 'menu';
  var closeLabel = btn.getAttribute('data-label-close') || openLabel;

  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? closeLabel : openLabel);
    nav.classList.toggle('is-open', open);
  }
  function langOpen() { return !!(langMenu && langMenu.classList.contains('is-open')); }
  function closeLang() {
    if (!langMenu) return;
    langMenu.classList.remove('is-open');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function () {
    var next = !isOpen();
    setOpen(next);
    if (!next) closeLang();
  });

  /* 点任意业务导航链接（含语言切换链接）后收起面板；语言按钮不是链接，不触发收起 */
  menu.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a') : null;
    if (link) setOpen(false);
  });

  document.addEventListener('click', function (e) {
    if (!isOpen()) return;
    if (btn.contains(e.target) || menu.contains(e.target)) return;
    setOpen(false);
    closeLang();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!isOpen()) return;
    if (langOpen()) return; /* 语言菜单开着：让语言切换器先处理这次 Escape */
    setOpen(false);
    btn.focus();
  }, true);

  /* 回到桌面宽度时复位，避免下次进移动端仍残留展开态 */
  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && isOpen()) { setOpen(false); closeLang(); }
  });
})();
