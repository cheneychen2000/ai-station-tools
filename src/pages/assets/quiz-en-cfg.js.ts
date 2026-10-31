/**
 * assets/quiz-en-cfg.js 静态端点：英文测验配置与 UI 文案（i18n 字典 QUIZ_EN 序列化）。
 * 四个函数字段（progress/score/percentile/share）按迁移前约定输出**原始源码文本**：
 * 端点代码经 Vite 打包后 fn.toString() 会被 esbuild 重排，因此改为从字典源文件按行提取，
 * 保证产物字节稳定（产物内容即对外契约）。
 */
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUIZ_EN } from '../../lib/i18n/dictionaries.mjs';

const FN_KEYS = ['progress', 'score', 'percentile', 'share'] as const;

function rawFnSources(): Record<(typeof FN_KEYS)[number], string> {
  const src = readFileSync(join(process.cwd(), 'src/lib/i18n/dictionaries.mjs'), 'utf8');
  const out = {} as Record<(typeof FN_KEYS)[number], string>;
  for (const key of FN_KEYS) {
    const m = src.match(new RegExp(`${key}:\\s*(function[^{]*\\{[^\\r\\n]*\\})`));
    if (!m) throw new Error(`quiz-en-cfg 生成失败：dictionaries.mjs 中未找到 ${key} 的单行函数定义`);
    out[key] = m[1];
  }
  return out;
}

export const GET: APIRoute = () => {
  const fn = rawFnSources();
  const body = `/* 自动生成：src/lib/i18n.mjs QUIZ_EN 序列化，构建期写入，禁止手改 */\n`
    + `window.QUIZ_EN_CFG = ${JSON.stringify({ dims: QUIZ_EN.dims, tiers: QUIZ_EN.tiers, weakLinks: QUIZ_EN.weakLinks })};\n`
    + `window.QUIZ_EN_UI = {\n`
    + `  progress: ${fn.progress},\n`
    + `  correct: ${JSON.stringify(QUIZ_EN.ui.correct)}, wrong: ${JSON.stringify(QUIZ_EN.ui.wrong)},\n`
    + `  next: ${JSON.stringify(QUIZ_EN.ui.next)}, result: ${JSON.stringify(QUIZ_EN.ui.result)},\n`
    + `  score: ${fn.score},\n`
    + `  percentile: ${fn.percentile},\n`
    + `  copyDone: ${JSON.stringify(QUIZ_EN.ui.copyDone)}, copyBtn: ${JSON.stringify(QUIZ_EN.ui.copyBtn)}, copyFail: ${JSON.stringify(QUIZ_EN.ui.copyFail)},\n`
    + `  posterTitle: ${JSON.stringify(QUIZ_EN.ui.posterTitle)}, posterSub: ${JSON.stringify(QUIZ_EN.ui.posterSub)},\n`
    + `  posterScan: ${JSON.stringify(QUIZ_EN.ui.posterScan)}, posterNote: ${JSON.stringify(QUIZ_EN.ui.posterNote)},\n`
    + `  share: ${fn.share},\n`
    + `  start: ${JSON.stringify(QUIZ_EN.ui.start)}, loadFail: ${JSON.stringify(QUIZ_EN.ui.loadFail)}\n`
    + `};\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
};
