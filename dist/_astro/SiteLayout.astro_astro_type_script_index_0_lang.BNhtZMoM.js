// src/scripts/app.ts
window.ASSETS_BASE = window.ASSETS_BASE || "assets";
window.track = function(event, params) {
	try {
		console.debug("[track]", event, params || {});
		(window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, params || {}));
	} catch {}
};
window.CF_ANALYTICS_TOKEN = window.CF_ANALYTICS_TOKEN || "";
(function loadCfAnalytics() {
	if (!window.CF_ANALYTICS_TOKEN) return;
	try {
		const s = document.createElement("script");
		s.defer = true;
		s.src = "https://static.cloudflareinsights.com/beacon.min.js";
		s.setAttribute("data-cf-beacon", JSON.stringify({ token: window.CF_ANALYTICS_TOKEN }));
		document.head.appendChild(s);
	} catch {}
})();
(function loadAdsGate() {
	if (location.hostname !== "www.reflex-hub.com") return;
	fetch(window.ASSETS_BASE + "/data/ads.json").then((r) => r.json()).then((cfg) => {
		if (!cfg || cfg.enabled !== true) return;
		if (typeof cfg.publisherId !== "string" || !/^ca-pub-\d{16}$/.test(cfg.publisherId)) return;
		if (!cfg.cmp || cfg.cmp.status !== "google-certified") return;
		const s = document.createElement("script");
		s.async = true;
		s.crossOrigin = "anonymous";
		s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(cfg.publisherId);
		document.head.appendChild(s);
	}).catch(() => {});
})();
(function langHint() {
	const switchLink = document.querySelector("a.lang-switch");
	if (!switchLink) return;
	const current = document.documentElement.lang || "zh-CN";
	function bindChoice(link) {
		link.addEventListener("click", () => {
			try {
				localStorage.setItem("rh_lang_pref", current === "en" ? "zh-CN" : "en");
			} catch {}
		});
	}
	bindChoice(switchLink);
	let pref = null, dismissed = false;
	try {
		pref = localStorage.getItem("rh_lang_pref");
	} catch {}
	try {
		dismissed = sessionStorage.getItem("rh_lang_hint_off") === "1";
	} catch {}
	if (dismissed) return;
	const browser = navigator.languages && navigator.languages[0] || navigator.language || "";
	const showToEn = current !== "en" && (pref === "en" || !pref && /^en/i.test(browser));
	if (!showToEn && !(current === "en" && pref === "zh-CN")) return;
	const bar = document.createElement("div");
	bar.className = "lang-hint";
	bar.setAttribute("role", "note");
	const text = document.createElement("span");
	text.textContent = showToEn ? "This page is also available in English." : "本页面提供中文版本。";
	const go = document.createElement("a");
	go.className = "lang-switch";
	go.href = switchLink.getAttribute("href") || "#";
	go.textContent = showToEn ? "English →" : "中文 →";
	bindChoice(go);
	const close = document.createElement("button");
	close.type = "button";
	close.className = "lang-hint-close";
	close.setAttribute("aria-label", showToEn ? "Dismiss" : "关闭");
	close.textContent = "×";
	close.addEventListener("click", () => {
		bar.remove();
		try {
			sessionStorage.setItem("rh_lang_hint_off", "1");
		} catch {}
	});
	bar.appendChild(text);
	bar.appendChild(go);
	bar.appendChild(close);
	document.body.appendChild(bar);
})();
(function langSwitcher() {
	const btnEl = document.getElementById("langBtn");
	const menuEl = document.getElementById("langMenu");
	if (!btnEl || !menuEl) return;
	const btn = btnEl;
	const menu = menuEl;
	let isOpen = false;
	function items() {
		return Array.prototype.slice.call(menu.querySelectorAll("[role^=\"menuitem\"]"));
	}
	function place() {
		const r = btn.getBoundingClientRect();
		const w = menu.offsetWidth || 144;
		const h = menu.offsetHeight || 44;
		const gap = 8;
		let left = Math.min(r.right - w, window.innerWidth - w - 8);
		left = Math.max(8, left);
		let top = r.bottom + gap;
		if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
		menu.style.left = Math.round(left) + "px";
		menu.style.top = Math.round(top) + "px";
	}
	function setOpen(open, focusFirst) {
		if (isOpen === open) return;
		isOpen = open;
		btn.setAttribute("aria-expanded", open ? "true" : "false");
		menu.classList.toggle("is-open", open);
		if (open) {
			place();
			if (focusFirst) {
				const list = items();
				if (list.length > 1) list[1].focus();
			}
		}
	}
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		setOpen(!isOpen, false);
	});
	menu.addEventListener("click", (e) => {
		if (e.target.closest("a")) setOpen(false, false);
	});
	document.addEventListener("click", (e) => {
		if (!isOpen) return;
		if (btn.contains(e.target) || menu.contains(e.target)) return;
		setOpen(false, false);
	});
	document.addEventListener("keydown", (e) => {
		if (!isOpen) return;
		if (e.key === "Escape" || e.key === "Esc") {
			setOpen(false, false);
			btn.focus();
			return;
		}
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			const list = items().filter((el) => el.tabIndex !== -1 || el.tagName === "A");
			if (!list.length) return;
			const idx = list.indexOf(document.activeElement);
			let next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
			if (next < 0) next = list.length - 1;
			if (next >= list.length) next = 0;
			list[next].focus();
			e.preventDefault();
		}
	});
	window.addEventListener("resize", () => {
		if (isOpen) place();
	});
	window.addEventListener("scroll", () => {
		if (isOpen) place();
	}, true);
})();
(function navToggle() {
	const btnEl = document.getElementById("navToggle");
	const menuEl = document.getElementById("siteMenu");
	const navEl = menuEl && menuEl.closest ? menuEl.closest(".site-nav") : null;
	if (!btnEl || !menuEl || !navEl) return;
	const btn = btnEl;
	const menu = menuEl;
	const nav = navEl;
	const langBtn = document.getElementById("langBtn");
	const langMenu = document.getElementById("langMenu");
	const openLabel = btn.getAttribute("data-label-open") || btn.getAttribute("aria-label") || "menu";
	const closeLabel = btn.getAttribute("data-label-close") || openLabel;
	function isOpen() {
		return btn.getAttribute("aria-expanded") === "true";
	}
	function setOpen(open) {
		btn.setAttribute("aria-expanded", open ? "true" : "false");
		btn.setAttribute("aria-label", open ? closeLabel : openLabel);
		nav.classList.toggle("is-open", open);
	}
	function langOpen() {
		return !!(langMenu && langMenu.classList.contains("is-open"));
	}
	function closeLang() {
		if (!langMenu) return;
		langMenu.classList.remove("is-open");
		if (langBtn) langBtn.setAttribute("aria-expanded", "false");
	}
	btn.addEventListener("click", () => {
		const next = !isOpen();
		setOpen(next);
		if (!next) closeLang();
	});
	menu.addEventListener("click", (e) => {
		if (e.target && e.target.closest ? e.target.closest("a") : null) setOpen(false);
	});
	document.addEventListener("click", (e) => {
		if (!isOpen()) return;
		if (btn.contains(e.target) || menu.contains(e.target)) return;
		setOpen(false);
		closeLang();
	});
	document.addEventListener("keydown", (e) => {
		if (e.key !== "Escape" && e.key !== "Esc") return;
		if (!isOpen()) return;
		if (langOpen()) return;
		setOpen(false);
		btn.focus();
	}, true);
	window.addEventListener("resize", () => {
		if (window.innerWidth > 768 && isOpen()) {
			setOpen(false);
			closeLang();
		}
	});
})();
