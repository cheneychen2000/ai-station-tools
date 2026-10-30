/**
 * Astro 构建后处理集成（astro:build:done）。
 *
 * 迁移原则：凡是"必须由同一逻辑生成、且不属于 Astro 页面路由"的产物，都在这里用**原有模块**生成，
 * 不做第二套实现：
 *  1. sitemap.xml —— src/lib/manifest.mjs 的 buildManifest（lastmod 业务规则原样保留，禁止用构建日期）；
 *  2. 浏览器端生成资产 —— assets/labels-en.js、assets/quiz-en-cfg.js、assets/data/quiz-en.json、
 *     assets/data/compare-pairs.json（序列化逻辑与旧构建逐字相同）；
 *  3. 联盟/广告占位符 —— src/lib/placement.mjs 的状态机在产物上照常推进
 *     （BEGIN/END 注释标记在 .astro 源文件中原样保留，构建期整段重写，语义零变化）。
 *
 * 放在构建后而不是 public/ 的原因：这些文件是"由 i18n 字典与模型数据派生"的构建产物，
 * 进 public/ 会变成需要手工同步的第二份事实源（违反"同一逻辑再生成"与"事实数据只有一份"）。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, DATA } from '../lib/paths.mjs';
import { loadData, buildManifest } from '../lib/manifest.mjs';
import { replacePlacementMarkers } from '../lib/placement.mjs';
import { pairs } from '../lib/site.mjs';
import { EN_VENDOR, EN_MODALITY, EN_FEATURE, EN_TIER_DESC, EN_PROMPT_SCENE, EN_PROMPT_TAG, EN_PROMPT_TITLE, QUIZ_EN } from '../lib/i18n.mjs';

const walkHtml = (dir, base = '') => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  const rel = base ? `${base}/${name}` : name;
  if (statSync(p).isDirectory()) return walkHtml(p, rel);
  return name.endsWith('.html') ? [rel] : [];
});

/** @returns {import('astro').AstroIntegration} */
export default function postBuild() {
  return {
    name: 'reflex-hub-post-build',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const log = logger || console;

        /* ---------- 1. sitemap（同一 manifest 规则，lastmod 取自内容/数据真实更新日） ---------- */
        const { models, tools, pagesMeta, compares } = loadData();
        const entries = buildManifest({ models, tools, pagesMeta, compares });
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => e.lastmod
          ? `  <url>\n    <loc>${SITE}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
          : `  <url>\n    <loc>${SITE}${e.path}</loc>\n  </url>`).join('\n')}
</urlset>
`;
        writeFileSync(join(outDir, 'sitemap.xml'), xml, 'utf8');
        log.info(`sitemap.xml：${entries.length} 条 URL（lastmod 由 manifest 规则驱动，非构建日期）`);

        /* ---------- 2. 浏览器端生成资产（与旧构建同一序列化逻辑） ---------- */
        writeFileSync(join(outDir, 'assets/labels-en.js'),
          `/* 自动生成：src/lib/i18n.mjs 序列化，构建期写入，禁止手改 */\nwindow.EnLabels = ${JSON.stringify({ vendor: EN_VENDOR, modality: EN_MODALITY, feature: EN_FEATURE, tierDesc: EN_TIER_DESC.map(x => [...x]), promptScene: EN_PROMPT_SCENE, promptTag: EN_PROMPT_TAG, promptTitle: EN_PROMPT_TITLE })};\n`, 'utf8');

        writeFileSync(join(outDir, 'assets/data/quiz-en.json'),
          JSON.stringify(QUIZ_EN.bank.map(({ dim, hard, q, options, answer, explain }) => ({ dim, hard, q, options, answer, explain })), null, 1) + '\n', 'utf8');

        writeFileSync(join(outDir, 'assets/quiz-en-cfg.js'),
          `/* 自动生成：src/lib/i18n.mjs QUIZ_EN 序列化，构建期写入，禁止手改 */\n` +
          `window.QUIZ_EN_CFG = ${JSON.stringify({ dims: QUIZ_EN.dims, tiers: QUIZ_EN.tiers, weakLinks: QUIZ_EN.weakLinks })};\n` +
          `window.QUIZ_EN_UI = {\n` +
          `  progress: ${QUIZ_EN.ui.progress.toString()},\n` +
          `  correct: ${JSON.stringify(QUIZ_EN.ui.correct)}, wrong: ${JSON.stringify(QUIZ_EN.ui.wrong)},\n` +
          `  next: ${JSON.stringify(QUIZ_EN.ui.next)}, result: ${JSON.stringify(QUIZ_EN.ui.result)},\n` +
          `  score: ${QUIZ_EN.ui.score.toString()},\n` +
          `  percentile: ${QUIZ_EN.ui.percentile.toString()},\n` +
          `  copyDone: ${JSON.stringify(QUIZ_EN.ui.copyDone)}, copyBtn: ${JSON.stringify(QUIZ_EN.ui.copyBtn)}, copyFail: ${JSON.stringify(QUIZ_EN.ui.copyFail)},\n` +
          `  posterTitle: ${JSON.stringify(QUIZ_EN.ui.posterTitle)}, posterSub: ${JSON.stringify(QUIZ_EN.ui.posterSub)},\n` +
          `  posterScan: ${JSON.stringify(QUIZ_EN.ui.posterScan)}, posterNote: ${JSON.stringify(QUIZ_EN.ui.posterNote)},\n` +
          `  share: ${QUIZ_EN.ui.share.toString()},\n` +
          `  start: ${JSON.stringify(QUIZ_EN.ui.start)}, loadFail: ${JSON.stringify(QUIZ_EN.ui.loadFail)}\n` +
          `};\n`, 'utf8');

        writeFileSync(join(outDir, 'assets/data/compare-pairs.json'), JSON.stringify({
          description: '已生成的对比页组合清单（a<b 归一）。/compare/ 选择器仅允许跳转清单内组合；新增组合须登记 compares.json allowlist 并重新构建。',
          pairs
        }, null, 1) + '\n', 'utf8');
        log.info(`browser assets：labels-en.js / quiz-en-cfg.js / quiz-en.json / compare-pairs.json（${pairs.length} 组对比）`);

        /* ---------- 3. 联盟/广告占位符状态机（产物级推进，源文件标记原样保留） ---------- */
        const partners = JSON.parse(readFileSync(join(DATA, 'assets/data/partners.json'), 'utf8')).partners || [];
        const adsCfg = JSON.parse(readFileSync(join(DATA, 'assets/data/ads.json'), 'utf8'));
        let touched = 0;
        for (const rel of walkHtml(outDir)) {
          const p = join(outDir, rel);
          const html = readFileSync(p, 'utf8');
          if (!html.includes('<!-- AFFILIATE:') && !html.includes('<!-- ADSLOT:')) continue;
          writeFileSync(p, replacePlacementMarkers(html, partners, adsCfg), 'utf8');
          touched++;
        }
        log.info(`placement markers：${touched} 个页面按 candidate/active/paused 状态机重写`);
      }
    }
  };
}
