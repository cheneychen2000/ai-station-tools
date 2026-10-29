/* 模型库浏览器端搜索/筛选/排序（中英共用）：直接操作构建期静态卡片，无 JS 时全部卡片照常可见。
   价格排序键 data-cost 由构建脚本用 models.json + fx.json 统一折算 CNY 生成，不比较不同币种原始数字。
   唯一语言相关项 = countText 计数文案，由页面注入。 */
(function () {
  window.initLibFilter = function (opts) {
    opts = opts || {};
    var countText = opts.countText || function (visible, total) { return '显示 ' + visible + ' / ' + total + ' 款模型'; };
    var list = document.getElementById('modelList');
    var search = document.getElementById('libSearch');
    var vendor = document.getElementById('libVendor');
    var cur = document.getElementById('libCur');
    var sort = document.getElementById('libSort');
    var count = document.getElementById('libCount');
    var empty = document.getElementById('libEmpty');
    if (!list || !search) return;
    var cards = Array.prototype.slice.call(list.querySelectorAll('.module-card'));
    cards.forEach(function (c, i) { c.dataset.idx = i; });

    /* 厂商选项从卡片数据属性生成，与构建期写入保持一致 */
    var vendors = [];
    cards.forEach(function (c) {
      var v = c.dataset.vendor || '';
      if (v && vendors.indexOf(v) < 0) vendors.push(v);
    });
    vendors.forEach(function (v) { vendor.add(new Option(v, v)); });

    function costOf(c) { var v = parseFloat(c.dataset.cost); return isFinite(v) ? v : null; }
    function cmp(a, b) {
      if (sort.value === 'cost-asc') {
        var ca = costOf(a), cb = costOf(b);
        if (ca == null && cb == null) return a.dataset.idx - b.dataset.idx;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return ca - cb || a.dataset.idx - b.dataset.idx;
      }
      if (sort.value === 'ctx-desc') return (parseFloat(b.dataset.ctx) - parseFloat(a.dataset.ctx)) || a.dataset.idx - b.dataset.idx;
      if (sort.value === 'date-desc') return ((b.dataset.verified || '') < (a.dataset.verified || '') ? -1 : (b.dataset.verified || '') > (a.dataset.verified || '') ? 1 : 0) || a.dataset.idx - b.dataset.idx;
      return a.dataset.idx - b.dataset.idx;
    }
    function apply() {
      var q = search.value.trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (c) {
        var show = (!q || (c.dataset.search || '').indexOf(q) >= 0) &&
          (!vendor.value || c.dataset.vendor === vendor.value) &&
          (!cur.value || c.dataset.cur === cur.value);
        c.hidden = !show;
        if (show) visible++;
      });
      cards.slice().sort(cmp).forEach(function (c) { list.appendChild(c); });
      count.textContent = countText(visible, cards.length);
      empty.hidden = visible > 0;
    }
    [search, vendor, cur, sort].forEach(function (el) {
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });
    document.getElementById('libClear').addEventListener('click', function () {
      search.value = ''; vendor.value = ''; cur.value = ''; sort.value = '';
      apply();
      search.focus();
    });
    apply();
  };
})();
