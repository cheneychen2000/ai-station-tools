/**
 * 工具目录埋点委托：卡片内容由构建期静态生成，此处仅保留与静态内容无关的点击埋点。
 */
declare global {
  interface Window { track?: (event: string, params?: Record<string, unknown>) => void }
}

export {};

function init(): void {
  document.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest && (e.target as HTMLElement).closest('a[data-tool]');
    if (a) window.track && window.track('tool_outbound', { id: a.getAttribute('data-tool') });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
