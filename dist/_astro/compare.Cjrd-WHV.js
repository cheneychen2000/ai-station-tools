import { i as EN_VENDOR } from "./dictionaries.DckWcrbT.js";
// src/scripts/compare.ts
/**
* 模型对比目录页选择器（中英双端共用模块，按 <html lang> 切换文案）：
* 读取同一份 models.json 与 compare-pairs.json（相对路径经 window.ASSETS_BASE 推导），
* a<b 归一跳转、同模型拦截、组合白名单校验——与迁移前两份内联脚本逐字一致。
* 英文端厂商名经 i18n 字典呈现。
*/
var en = document.documentElement.lang === "en";
var T = (zh, e) => en ? e : zh;
function boot() {
	Promise.all([fetch(window.ASSETS_BASE + "/data/models.json").then((res) => res.json()), fetch(window.ASSETS_BASE + "/data/compare-pairs.json").then((res) => res.json())]).then((res) => {
		const models = res[0];
		const pairSet = {};
		(res[1].pairs || []).forEach((p) => {
			pairSet[p[0] + "/" + p[1]] = true;
		});
		const selA = document.getElementById("selA");
		const selB = document.getElementById("selB");
		const btnGo = document.getElementById("btnGo");
		const cmpHint = document.getElementById("cmpHint");
		if (!selA || !selB || !btnGo || !cmpHint) return;
		models.forEach((m) => {
			const label = en ? `${m.name} (${EN_VENDOR[m.vendor] || m.vendor})` : `${m.name}（${m.vendor}）`;
			selA.add(new Option(label, m.id));
			selB.add(new Option(label, m.id));
		});
		if (models.length > 1) selB.selectedIndex = 1;
		const qa = /[?&]a=([a-z0-9\-]+)/i.exec(location.search);
		if (qa) selA.value = qa[1];
		btnGo.addEventListener("click", () => {
			const a = selA.value, b = selB.value;
			if (a === b) {
				cmpHint.textContent = T("请选择两款不同的模型", "Please choose two different models");
				return;
			}
			const ids = [a, b].sort();
			if (!pairSet[ids[0] + "/" + ids[1]]) {
				cmpHint.textContent = T("该组合的对比页暂未生成（现有 " + Object.keys(pairSet).length + " 组对比），可在下方常用入口或模型库档案中查看", "This pair has no comparison page yet (" + Object.keys(pairSet).length + " pairs exist). Try the shortcuts above or the model library.");
				return;
			}
			location.href = ids[0] + "/" + ids[1] + "/";
		});
	}).catch(() => {
		const cmpHint = document.getElementById("cmpHint");
		if (cmpHint) cmpHint.textContent = T("模型数据加载失败，请刷新重试", "Failed to load model data — please refresh");
	});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
