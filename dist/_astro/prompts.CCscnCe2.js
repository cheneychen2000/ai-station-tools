// src/scripts/prompts.ts
function showToast(text) {
	const t = document.getElementById("toast");
	if (!t) return;
	t.textContent = text;
	t.classList.add("show");
	const el = t;
	window.clearTimeout(el._timer);
	el._timer = window.setTimeout(() => t.classList.remove("show"), 1600);
}
function legacyCopy(text, done) {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	ta.select();
	try {
		document.execCommand("copy");
		done();
	} catch {
		document.dispatchEvent(new CustomEvent("prompt-copy-failed"));
	} finally {
		document.body.removeChild(ta);
	}
}
function copyText(text, done) {
	if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
	else legacyCopy(text, done);
}
function init() {
	const box = document.getElementById("promptList");
	if (!box) return;
	const cfg = {
		copyDone: box.dataset.copyDone || "已复制",
		copyFail: box.dataset.copyFail || "复制失败，请手动选择文本",
		lang: box.dataset.lang || void 0
	};
	box.addEventListener("click", (e) => {
		const btn = e.target.closest(".copy-btn");
		if (!btn) return;
		const card = btn.closest(".result-card");
		const pre = card && card.querySelector(".prompt-text");
		const text = pre ? pre.textContent : "";
		if (!text) return;
		copyText(text, () => {
			showToast(cfg.copyDone);
			window.track && window.track("prompt_copy", {
				id: card.getAttribute("data-prompt-id"),
				lang: cfg.lang
			});
		});
	});
	document.addEventListener("prompt-copy-failed", () => showToast(cfg.copyFail));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
