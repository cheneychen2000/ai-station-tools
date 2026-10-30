/**
 * Prompt 库交互：复制按钮（从 DOM 读取 Prompt 文本，绝不拼接 innerHTML）、
 * 成功/失败 toast、复制埋点。配置经 #promptList 的 data-* 属性注入（页面语言无关）。
 */
interface PromptListConfig {
  copyDone: string;
  copyFail: string;
  lang?: string | undefined;
}

declare global {
  interface Window { track?: (event: string, data?: Record<string, unknown>) => void }
}

export {};

function showToast(text: string): void {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.classList.add('show');
  const el = t as HTMLElement & { _timer?: number };
  window.clearTimeout(el._timer);
  el._timer = window.setTimeout(() => t.classList.remove('show'), 1600);
}

function legacyCopy(text: string, done: () => void): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    document.dispatchEvent(new CustomEvent('prompt-copy-failed'));
  } finally {
    document.body.removeChild(ta);
  }
}

function copyText(text: string, done: () => void): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
  } else {
    legacyCopy(text, done);
  }
}

function init(): void {
  const box = document.getElementById('promptList');
  if (!box) return;
  const cfg: PromptListConfig = {
    copyDone: box.dataset.copyDone || '已复制',
    copyFail: box.dataset.copyFail || '复制失败，请手动选择文本',
    lang: box.dataset.lang || undefined
  };
  box.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.copy-btn');
    if (!btn) return;
    const card = btn.closest('.result-card');
    const pre = card && card.querySelector('.prompt-text');
    const text = pre ? pre.textContent : '';
    if (!text) return;
    copyText(text, () => {
      showToast(cfg.copyDone);
      window.track && window.track('prompt_copy', { id: card!.getAttribute('data-prompt-id'), lang: cfg.lang });
    });
  });
  document.addEventListener('prompt-copy-failed', () => showToast(cfg.copyFail));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
