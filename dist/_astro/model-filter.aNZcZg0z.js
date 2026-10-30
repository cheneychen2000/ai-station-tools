// src/scripts/model-filter.ts
/**
* 模型库浏览器端搜索/筛选/排序（中英共用，Vite 打包模块，模型库页面加载）：
* 直接操作构建期静态卡片，无 JS 时全部卡片照常可见。
* 价格排序键 data-cost 由构建期用 models.json + fx.json 统一折算 CNY 生成，不比较不同币种原始数字。
* 唯一语言相关项 = countText 计数文案，按 <html lang> 选择（zh-CN / en）。
*/
function init() {
	const countText = document.documentElement.lang === "en" ? (visible, total) => "Showing " + visible + " of " + total + " models" : (visible, total) => "显示 " + visible + " / " + total + " 款模型";
	const listEl = document.getElementById("modelList");
	const searchEl = document.getElementById("libSearch");
	const vendorEl = document.getElementById("libVendor");
	const curEl = document.getElementById("libCur");
	const sortEl = document.getElementById("libSort");
	const countEl = document.getElementById("libCount");
	const emptyEl = document.getElementById("libEmpty");
	const clearEl = document.getElementById("libClear");
	if (!listEl || !searchEl || !vendorEl || !curEl || !sortEl || !countEl || !emptyEl || !clearEl) return;
	const list = listEl;
	const search = searchEl;
	const vendor = vendorEl;
	const cur = curEl;
	const sort = sortEl;
	const count = countEl;
	const empty = emptyEl;
	const clear = clearEl;
	const cards = Array.prototype.slice.call(list.querySelectorAll(".module-card"));
	cards.forEach((c, i) => {
		c.dataset.idx = String(i);
	});
	const vendors = [];
	cards.forEach((c) => {
		const v = c.dataset.vendor || "";
		if (v && vendors.indexOf(v) < 0) vendors.push(v);
	});
	vendors.forEach((v) => vendor.add(new Option(v, v)));
	function costOf(c) {
		const v = parseFloat(c.dataset.cost || "");
		return isFinite(v) ? v : null;
	}
	function cmp(a, b) {
		if (sort.value === "cost-asc") {
			const ca = costOf(a), cb = costOf(b);
			if (ca == null && cb == null) return Number(a.dataset.idx) - Number(b.dataset.idx);
			if (ca == null) return 1;
			if (cb == null) return -1;
			return ca - cb || Number(a.dataset.idx) - Number(b.dataset.idx);
		}
		if (sort.value === "ctx-desc") return parseFloat(b.dataset.ctx || "0") - parseFloat(a.dataset.ctx || "0") || Number(a.dataset.idx) - Number(b.dataset.idx);
		if (sort.value === "date-desc") return ((b.dataset.verified || "") < (a.dataset.verified || "") ? -1 : (b.dataset.verified || "") > (a.dataset.verified || "") ? 1 : 0) || Number(a.dataset.idx) - Number(b.dataset.idx);
		return Number(a.dataset.idx) - Number(b.dataset.idx);
	}
	function apply() {
		const q = search.value.trim().toLowerCase();
		let visible = 0;
		cards.forEach((c) => {
			const show = (!q || (c.dataset.search || "").indexOf(q) >= 0) && (!vendor.value || c.dataset.vendor === vendor.value) && (!cur.value || c.dataset.cur === cur.value);
			c.hidden = !show;
			if (show) visible++;
		});
		cards.slice().sort(cmp).forEach((c) => list.appendChild(c));
		count.textContent = countText(visible, cards.length);
		empty.hidden = visible > 0;
	}
	[
		search,
		vendor,
		cur,
		sort
	].forEach((el) => {
		el.addEventListener("input", apply);
		el.addEventListener("change", apply);
	});
	clear.addEventListener("click", () => {
		search.value = "";
		vendor.value = "";
		cur.value = "";
		sort.value = "";
		apply();
		search.focus();
	});
	apply();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
